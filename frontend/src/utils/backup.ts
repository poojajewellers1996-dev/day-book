import { getSyncedDateString } from "./timeUtils";

export const exportBackup = () => {
  if (typeof window === "undefined") return;

  const backupData: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("daybook_") || key === "sync_queue")) {
      backupData[key] = localStorage.getItem(key) || "";
    }
  }

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = getSyncedDateString();
  a.href = url;
  a.download = `Pooja_Jewellers_DayBook_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importBackup = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (typeof data !== "object") throw new Error("Invalid format");

        Object.keys(data).forEach((key) => {
          if (key.startsWith("daybook_") || key === "sync_queue") {
            localStorage.setItem(key, data[key]);
          }
        });
        resolve(true);
      } catch (err) {
        console.error("Backup import failed", err);
        resolve(false);
      }
    };
    reader.onerror = () => resolve(false);
    reader.readAsText(file);
  });
};
