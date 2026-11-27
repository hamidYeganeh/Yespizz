import "server-only";
import { staffStore } from "../../../../packages/staff/store.mjs";
export const store = () => staffStore("business");
