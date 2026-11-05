// Turns a delivery into an ArduCopter AUTO mission (MAVLink mission items).
// The same items are uploaded by drone-bridge/bridge.py and exported as a Mission Planner
// .waypoints file, so the plan the operator reviews is exactly what the drone flies.
// Command reference: https://ardupilot.org/copter/docs/common-mavlink-mission-command-messages-mav_cmd.html
import { config } from '../config';
import type { MissionPhase, MissionPlan } from './types';

export const MAV_CMD = {
  NAV_WAYPOINT: 16,
  NAV_LOITER_UNLIM: 17,
  NAV_LOITER_TIME: 19,
  NAV_RETURN_TO_LAUNCH: 20,
  NAV_TAKEOFF: 22,
  DO_CHANGE_SPEED: 178,
  DO_SET_SERVO: 183,
  DO_GRIPPER: 211,
  DO_WINCH: 42600,
} as const;

/** MAV_FRAME_GLOBAL_RELATIVE_ALT: altitudes are metres above home (the hub). */
export const FRAME_RELATIVE_ALT = 3;
const FRAME_GLOBAL = 0;

export interface MissionItem {
  seq: number;
  command: number;
  frame: number;
  params: [number, number, number, number]; // param1..param4
  lat: number;
  lon: number;
  alt: number;
  label: string; // human description for the ops UI
  // App phase that starts when this item becomes current. Only NAV items ever show up in
  // MISSION_CURRENT (DO items run instantly between them), so phases live on NAV items.
  phase?: MissionPhase;
}

export interface BuiltMission {
  items: MissionItem[];
  payloadMode: PayloadMode;
  clearanceSeq: number; // NAV_LOITER_UNLIM item: drone hovers here until the bridge skips it
  afterClearanceSeq: number; // where the bridge jumps when "area clear" is confirmed
  lowerS: number; // estimated time for the package to reach the ground
  retractS: number;
  clearanceTimeoutS: number; // bridge sends the drone home if nobody confirms "area clear"
  trigger: { servo: number; pwmDrop: number; pwmIdle: number; pwmAbort: number } | null; // esp32 mode only
}

/**
 * How the package gets down:
 *  - 'esp32': one PWM channel tells the ESP32 payload controller to run its whole
 *    lower → detect slack → release → retract sequence (our planned hardware).
 *  - 'ardupilot-winch': ArduPilot drives the winch itself (WINCH_TYPE set) with DO_WINCH,
 *    and a servo gripper with DO_GRIPPER.
 */
export type PayloadMode = 'esp32' | 'ardupilot-winch';

export function buildMission(plan: Omit<MissionPlan, 'mission'>, mode: PayloadMode = config.mission.payloadMode): BuiltMission {
  const m = config.mission;
  const { home, target, cruiseAltM, dropAltM } = plan;
  const ropeM = +(dropAltM - 0.2).toFixed(2);
  const lowerS = Math.ceil(ropeM / m.lowerRateMs) + 3;
  const retractS = Math.ceil(ropeM / m.retractRateMs) + 3;

  const items: Omit<MissionItem, 'seq'>[] = [];
  const add = (command: number, label: string, opts: Partial<Omit<MissionItem, 'seq' | 'command' | 'label'>> = {}) =>
    items.push({ command, label, frame: FRAME_RELATIVE_ALT, params: [0, 0, 0, 0], lat: 0, lon: 0, alt: 0, ...opts });
  const at = (p: { lat: number; lon: number }, alt: number) => ({ lat: p.lat, lon: p.lon, alt });

  // Item 0 is the home position; ArduPilot overwrites it with the real home on arming.
  add(MAV_CMD.NAV_WAYPOINT, 'Home (hub)', { frame: FRAME_GLOBAL, ...at(home, 0) });
  add(MAV_CMD.NAV_TAKEOFF, `Take off to ${cruiseAltM} m`, { ...at(home, cruiseAltM), phase: 'takeoff' });
  add(MAV_CMD.DO_CHANGE_SPEED, `Cruise speed ${config.flight.cruiseSpeedMs} m/s`, { params: [1, config.flight.cruiseSpeedMs, -1, 0] });
  add(MAV_CMD.NAV_WAYPOINT, `Fly to drop zone at ${cruiseAltM} m`, { ...at(target, cruiseAltM), phase: 'cruise' });
  add(MAV_CMD.NAV_WAYPOINT, `Descend to ${dropAltM} m hover`, { ...at(target, dropAltM), params: [2, 0, 0, 0], phase: 'approach' });
  const clearanceSeq = items.length;
  add(MAV_CMD.NAV_LOITER_UNLIM, 'Hover: wait for "area clear"', { ...at(target, dropAltM), phase: 'awaiting_clearance' });
  const afterClearanceSeq = items.length;

  if (mode === 'esp32') {
    add(MAV_CMD.DO_SET_SERVO, `Signal ESP32: run drop sequence (SERVO${m.triggerServo} = ${m.pwmDrop} µs)`, { params: [m.triggerServo, m.pwmDrop, 0, 0] });
    add(MAV_CMD.NAV_LOITER_TIME, `Hold ${lowerS + 3 + retractS} s while it lowers, releases and reels in`, { ...at(target, dropAltM), params: [lowerS + 3 + retractS, 0, 0, 0], phase: 'lowering' });
    add(MAV_CMD.DO_SET_SERVO, `Signal ESP32: back to idle (${m.pwmIdle} µs)`, { params: [m.triggerServo, m.pwmIdle, 0, 0] });
  } else {
    add(MAV_CMD.DO_WINCH, `Winch: lower ${ropeM} m`, { params: [1, 1, ropeM, 0] });
    add(MAV_CMD.NAV_LOITER_TIME, `Hold ${lowerS} s while lowering`, { ...at(target, dropAltM), params: [lowerS, 0, 0, 0], phase: 'lowering' });
    add(MAV_CMD.DO_GRIPPER, 'Gripper: release package', { params: [1, 0, 0, 0] });
    add(MAV_CMD.NAV_LOITER_TIME, 'Hold 3 s after release', { ...at(target, dropAltM), params: [3, 0, 0, 0], phase: 'releasing' });
    add(MAV_CMD.DO_WINCH, `Winch: reel in ${ropeM} m`, { params: [1, 1, -ropeM, 0] });
    add(MAV_CMD.NAV_LOITER_TIME, `Hold ${retractS} s while reeling in`, { ...at(target, dropAltM), params: [retractS, 0, 0, 0], phase: 'retracting' });
    add(MAV_CMD.DO_GRIPPER, 'Gripper: close', { params: [1, 1, 0, 0] });
  }
  // Climb back to cruise height before heading home: RTL on its own only climbs to RTL_ALT
  // (15 m by default), which flew into raised ground between the drop zone and the hub in SITL.
  add(MAV_CMD.NAV_WAYPOINT, `Climb to ${cruiseAltM} m before heading home`, { ...at(target, cruiseAltM), phase: 'returning' });
  add(MAV_CMD.NAV_RETURN_TO_LAUNCH, `Return to hub at ${cruiseAltM} m and land`, { phase: 'returning' });

  return {
    items: items.map((it, seq) => ({ ...it, seq })),
    payloadMode: mode,
    clearanceSeq,
    afterClearanceSeq,
    lowerS,
    retractS,
    clearanceTimeoutS: m.clearanceTimeoutS,
    trigger: mode === 'esp32' ? { servo: m.triggerServo, pwmDrop: m.pwmDrop, pwmIdle: m.pwmIdle, pwmAbort: m.pwmAbort } : null,
  };
}

/** Mission Planner / QGroundControl plain-text mission file ("QGC WPL 110"). */
export function toWaypointsFile(m: BuiltMission): string {
  const n = (v: number, d = 8) => Number(v.toFixed(d)).toString();
  const lines = m.items.map((it) =>
    [it.seq, it.seq === 0 ? 1 : 0, it.frame, it.command, ...it.params.map((p) => n(p)), n(it.lat), n(it.lon), n(it.alt, 2), 1].join('\t'),
  );
  return ['QGC WPL 110', ...lines].join('\n') + '\n';
}
