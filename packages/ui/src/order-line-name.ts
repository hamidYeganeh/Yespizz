import messages from "../../i18n/src/messages/en/Application.json";
import { menu } from "./base-menu";

export function orderLineName(id: string, name: string) {
  const item = menu.find(item => item.id === id && item.key === name);
  return item ? messages.menu[item.key] : name;
}
