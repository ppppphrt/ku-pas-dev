import { useEffect, useState } from "react";
import { api, errorMessage } from "../services/courseApi";
import { AuthContext } from "./auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!sessionStorage.getItem("ku-token"));
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    if (sessionStorage.getItem("ku-token"))
      api
        .get("/auth/me")
        .then(({ data }) => {
          if (active) setUser(data);
        })
        .catch(() => {
          sessionStorage.removeItem("ku-token");
          if (active)
            setNotice(
              "Your session ended. Sign in to restore your account timetable.",
            );
        })
        .finally(() => {
          if (active) setReady(true);
        });
    const expire = () => {
      sessionStorage.removeItem("ku-token");
      setUser(null);
      setNotice("Your session ended. Please sign in again.");
      setReady(true);
    };
    window.addEventListener("ku-session-expired", expire);
    return () => {
      active = false;
      window.removeEventListener("ku-session-expired", expire);
    };
  }, []);
  async function authenticate(type, body) {
    const { data } = await api.post(`/auth/${type}`, body);
    sessionStorage.setItem("ku-token", data.access_token);
    setUser(data.user);
    setNotice("");
  }
  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      if (error.response?.status !== 401) {
        setNotice(errorMessage(error));
        return;
      }
    }
    sessionStorage.removeItem("ku-token");
    setUser(null);
    setNotice("Signed out. Your account timetable remains saved.");
  }
  return (
    <AuthContext.Provider value={{ user, ready, notice, authenticate, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
