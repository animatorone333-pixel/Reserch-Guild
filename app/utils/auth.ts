// utils/auth.ts
export type UserInfo = {
  department?: string;
  name?: string;
  nickname?: string;
  avatar?: string;
  image?: string;
  avatarUrl?: string;
  photoURL?: string;
};

/** ✅ 正規化頭像網址：支援 data/http/https/相對路徑 */
export function normalizeAvatarUrl(u?: string): string {
  if (!u) return "/game_04.png";
  const url = u.trim();
  if (/^data:image\//i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return url;
  return "/" + url.replace(/^\.?\//, "");
}

/** ✅ 驗證登入狀態並回傳使用者資料；無效則自動清除 */
export function getValidUser(): UserInfo | null {
  if (typeof window === "undefined") return null;

  const loggedIn = localStorage.getItem("mygame_loggedIn") === "true";
  const raw = localStorage.getItem("mygame_user");
  if (!loggedIn || !raw) {
    clearLoginState();
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const hasName = parsed.name || parsed.nickname;
    if (!hasName) {
      clearLoginState();
      return null;
    }
    const avatarRaw =
      parsed.avatar || parsed.image || parsed.avatarUrl || parsed.photoURL || "";
    const avatar = normalizeAvatarUrl(avatarRaw);
    return { ...parsed, avatar };
  } catch {
    clearLoginState();
    return null;
  }
}

/** ✅ 登出或清除異常登入資料 */
export function clearLoginState() {
  localStorage.removeItem("mygame_loggedIn");
  localStorage.removeItem("mygame_user");
}

