export interface SyncedTimeData {
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM:SS
  iso: string;        // Full ISO timestamp in Asia/Kolkata
  timestamp: number;  // Milliseconds since epoch
  source: string;
}

let cachedOffsetMs: number = 0;
let isSyncedWithInternet: boolean = false;

if (typeof window !== "undefined") {
  const saved = localStorage.getItem("pooja_daybook_time_offset");
  if (saved) {
    cachedOffsetMs = parseInt(saved, 10) || 0;
    if (cachedOffsetMs !== 0) {
      isSyncedWithInternet = true;
    }
  }
}

export async function fetchInternetTime(): Promise<SyncedTimeData | null> {
  const endpoints = [
    "http://localhost:8000/api/system/network-time",
    "https://worldtimeapi.org/api/timezone/Asia/Kolkata",
    "https://timeapi.io/api/v1/time/current/zone?timeZone=Asia/Kolkata"
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();

      let targetMs = 0;
      let dateStr = "";
      let timeStr = "";

      if (data.timestamp) {
        dateStr = data.date;
        timeStr = data.time;
        targetMs = data.timestamp;
      } else if (ep.includes("worldtimeapi")) {
        dateStr = data.datetime.slice(0, 10);
        timeStr = data.datetime.slice(11, 19);
        targetMs = new Date(data.datetime).getTime();
      } else if (ep.includes("timeapi.io")) {
        const year = data.year;
        const month = data.month;
        const day = data.day;
        const hour = data.hour;
        const minute = data.minute;
        const seconds = data.seconds;

        dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        targetMs = new Date(`${dateStr}T${timeStr}+05:30`).getTime();
      }

      if (targetMs > 0 && !isNaN(targetMs)) {
        cachedOffsetMs = targetMs - Date.now();
        isSyncedWithInternet = true;
        lastSyncSource = data.source || ep;
        if (typeof window !== "undefined") {
          localStorage.setItem("pooja_daybook_time_offset", cachedOffsetMs.toString());
        }
        return {
          date: dateStr,
          time: timeStr,
          iso: `${dateStr}T${timeStr}+05:30`,
          timestamp: targetMs,
          source: data.source || ep
        };
      }
    } catch (e) {
      // Try next endpoint
    }
  }

  // If cached offset exists, return constructed time data from cached offset
  if (cachedOffsetMs !== 0) {
    lastSyncSource = "cached_offset";
    const syncedDate = new Date(Date.now() + cachedOffsetMs);
    const year = syncedDate.getFullYear();
    const month = String(syncedDate.getMonth() + 1).padStart(2, "0");
    const day = String(syncedDate.getDate()).padStart(2, "0");
    const hour = String(syncedDate.getHours()).padStart(2, "0");
    const minute = String(syncedDate.getMinutes()).padStart(2, "0");
    const sec = String(syncedDate.getSeconds()).padStart(2, "0");

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}:${minute}:${sec}`;

    return {
      date: dateStr,
      time: timeStr,
      iso: `${dateStr}T${timeStr}+05:30`,
      timestamp: syncedDate.getTime(),
      source: "cached_offset"
    };
  }

  return null;
}

let lastSyncSource: string = "system";

export function getTimeOffsetMs(): number {
  return cachedOffsetMs;
}

export function getSyncSource(): string {
  return lastSyncSource;
}

export async function setManualTimeOffset(targetDateStr: string, targetTimeStr: string): Promise<SyncedTimeData> {
  const targetMs = new Date(`${targetDateStr}T${targetTimeStr}`).getTime();
  if (isNaN(targetMs)) {
    throw new Error("Invalid target date or time format");
  }

  cachedOffsetMs = targetMs - Date.now();
  isSyncedWithInternet = true;
  lastSyncSource = "manual_override";

  if (typeof window !== "undefined") {
    localStorage.setItem("pooja_daybook_time_offset", cachedOffsetMs.toString());
  }

  // Inform backend of new offset
  try {
    await fetch("http://localhost:8000/api/system/set-time-offset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offset_seconds: cachedOffsetMs / 1000 })
    });
  } catch (err) {
    console.warn("Could not sync offset to backend:", err);
  }

  const syncedDate = new Date(targetMs);
  const year = syncedDate.getFullYear();
  const month = String(syncedDate.getMonth() + 1).padStart(2, "0");
  const day = String(syncedDate.getDate()).padStart(2, "0");
  const hour = String(syncedDate.getHours()).padStart(2, "0");
  const minute = String(syncedDate.getMinutes()).padStart(2, "0");
  const sec = String(syncedDate.getSeconds()).padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}:${sec}`,
    iso: `${year}-${month}-${day}T${hour}:${minute}:${sec}+05:30`,
    timestamp: targetMs,
    source: "manual_override"
  };
}

export function getSyncedDate(): Date {
  return new Date(Date.now() + cachedOffsetMs);
}

export function getSyncedDateString(): string {
  const d = getSyncedDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getIsInternetTimeSynced(): boolean {
  return isSyncedWithInternet;
}

export interface TimeCheckResult {
  checked: boolean;
  success: boolean;
  mismatch: boolean;
  diff_seconds: number;
  diff_minutes: number;
  google_formatted: string;
  system_formatted: string;
  source: string;
}

export async function checkSystemVsGoogleTime(): Promise<TimeCheckResult> {
  const systemNow = new Date();
  const systemFormatted = systemNow.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
  });

  try {
    const res = await fetch("http://localhost:8000/api/system/google-time", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        const googleDate = new Date(data.google_timestamp);
        const googleFormatted = googleDate.toLocaleString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
        });

        return {
          checked: true,
          success: true,
          mismatch: data.mismatch,
          diff_seconds: data.diff_seconds,
          diff_minutes: data.diff_minutes,
          google_formatted: googleFormatted,
          system_formatted: systemFormatted,
          source: data.source
        };
      }
    }
  } catch (err) {
    console.warn("Could not check Google time via backend API:", err);
  }

  // Frontend direct fallback check to timeapi.io
  try {
    const res = await fetch("https://timeapi.io/api/v1/time/current/zone?timeZone=Asia/Kolkata", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.date_time) {
        const googleMs = new Date(data.date_time).getTime();
        const sysMs = systemNow.getTime();
        const diffSec = Math.abs(googleMs - sysMs) / 1000;
        const googleDate = new Date(googleMs);
        const googleFormatted = googleDate.toLocaleString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
        });

        return {
          checked: true,
          success: true,
          mismatch: diffSec > 60,
          diff_seconds: diffSec,
          diff_minutes: Math.round((diffSec / 60) * 10) / 10,
          google_formatted: googleFormatted,
          system_formatted: systemFormatted,
          source: "timeapi_direct"
        };
      }
    }
  } catch (e) {}

  // Frontend direct fallback check to worldtimeapi if timeapi was unreachable
  try {
    const res = await fetch("https://worldtimeapi.org/api/timezone/Asia/Kolkata", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const googleMs = new Date(data.datetime).getTime();
      const sysMs = systemNow.getTime();
      const diffSec = Math.abs(googleMs - sysMs) / 1000;
      const googleDate = new Date(googleMs);
      const googleFormatted = googleDate.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
      });

      return {
        checked: true,
        success: true,
        mismatch: diffSec > 60,
        diff_seconds: diffSec,
        diff_minutes: Math.round((diffSec / 60) * 10) / 10,
        google_formatted: googleFormatted,
        system_formatted: systemFormatted,
        source: "worldtimeapi_direct"
      };
    }
  } catch (e) {}

  return {
    checked: true,
    success: false,
    mismatch: false,
    diff_seconds: 0,
    diff_minutes: 0,
    google_formatted: systemFormatted,
    system_formatted: systemFormatted,
    source: "system"
  };
}

