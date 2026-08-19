import { toast } from "sonner";
import { notificationAudio } from "./notificationSound";

let initialized = false;

export function setupToastSound() {
  if (initialized) return;
  initialized = true;

  // Intercept toast methods to play synthesized sound chimes automatically
  const originalSuccess = toast.success.bind(toast);
  const originalError = toast.error.bind(toast);
  const originalWarning = toast.warning?.bind(toast);
  const originalInfo = toast.info.bind(toast);
  const originalMessage = toast.message?.bind(toast);
  const originalCustom = toast.custom?.bind(toast);

  toast.success = ((message: any, data?: any) => {
    notificationAudio.play("success");
    return originalSuccess(message, data);
  }) as typeof toast.success;

  toast.error = ((message: any, data?: any) => {
    notificationAudio.play("error");
    return originalError(message, data);
  }) as typeof toast.error;

  if (originalWarning) {
    toast.warning = ((message: any, data?: any) => {
      notificationAudio.play("warning");
      return originalWarning(message, data);
    }) as typeof toast.warning;
  }

  toast.info = ((message: any, data?: any) => {
    notificationAudio.play("info");
    return originalInfo(message, data);
  }) as typeof toast.info;

  if (originalMessage) {
    toast.message = ((message: any, data?: any) => {
      notificationAudio.play("default");
      return originalMessage(message, data);
    }) as typeof toast.message;
  }

  if (originalCustom) {
    toast.custom = ((jsx: any, data?: any) => {
      notificationAudio.play("default");
      return originalCustom(jsx, data);
    }) as typeof toast.custom;
  }
}
