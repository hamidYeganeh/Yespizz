"use client";

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { commerceApi } from "./commerce-client";

const deviceKey = "yespizz-push-device";

export async function enableNativePush() {
  const platform = Capacitor.getPlatform();
  if (platform !== "android" && platform !== "ios") throw new Error("Push is available in the mobile app.");
  const available = await commerceApi<{ android: boolean; ios: boolean }>("integrations/push");
  if (!available[platform]) throw new Error("Push notifications are not configured for this device.");
  await commerceApi("me");
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") throw new Error("Allow notifications in device settings.");
  let complete: (token: string) => void;
  let fail: (error: Error) => void;
  const result = new Promise<string>((resolve, reject) => { complete = resolve; fail = reject; });
  const registration = await PushNotifications.addListener("registration", ({ value }) => complete(value));
  const errors = await PushNotifications.addListener("registrationError", ({ error }) => fail(new Error(error)));
  const timer = setTimeout(() => fail(new Error("The device did not return a notification token.")), 15000);
  try {
    await PushNotifications.register();
    const token = await result;
    const device = await commerceApi<{ id: string }>("me/devices", "POST", { token, platform });
    localStorage.setItem(deviceKey, device.id);
  } finally {
    clearTimeout(timer);
    await Promise.all([registration.remove(), errors.remove()]);
  }
}

export async function disconnectNativePush() {
  const id = localStorage.getItem(deviceKey);
  if (!id || !Capacitor.isNativePlatform()) return;
  await commerceApi(`me/devices/${encodeURIComponent(id)}`, "DELETE");
  localStorage.removeItem(deviceKey);
}
