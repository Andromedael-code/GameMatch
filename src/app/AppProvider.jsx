import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { usePersistentState } from "../hooks/usePersistentState";
import { auth, db, ensureAuthPersistence } from "../lib/firebase";
import { subscribeToRoomMatches } from "../services/rooms";
import { resolveGameCover } from "../utils/gameMedia";
import { fallbackNickname, normalizeRoomId } from "../utils/validators";

const AppContext = createContext(null);

const defaultPreferences = {
  allowAdult: false,
  theme: "midnight",
};

const TOAST_VISIBLE_MS = 4200;
const TOAST_EXIT_MS = 300;

function createToastId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function AppProvider({ children }) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ nickname: "", email: "" });
  const [likedGames, setLikedGames] = useState([]);
  const [isLikedGamesLoading, setIsLikedGamesLoading] = useState(false);
  const [deckRefreshToken, setDeckRefreshToken] = useState(0);
  const [roomId, setRoomId] = usePersistentState("gm_active_room_v2", "");
  const [preferences, setPreferences] = usePersistentState("gm_preferences_v2", defaultPreferences);
  const [roomInfo, setRoomInfo] = useState(null);
  const [roomMembers, setRoomMembers] = useState([]);
  const [roomMatches, setRoomMatches] = useState([]);
  const [toasts, setToasts] = useState([]);
  const knownMatchIdsRef = useRef(new Set());
  const roomMatchesReadyRef = useRef(false);
  const toastTimeoutsRef = useRef(new Map());

  useEffect(() => {
    ensureAuthPersistence().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      startTransition(() => {
        setUser(nextUser ?? null);
        setAuthReady(true);
      });

      if (!nextUser) {
        setProfile({ nickname: "", email: "" });
        setLikedGames([]);
        setIsLikedGamesLoading(false);
        setRoomInfo(null);
        setRoomMembers([]);
        setRoomMatches([]);
        setRoomId("");
        setPreferences(defaultPreferences);
      } else {
        setIsLikedGamesLoading(true);
      }
    });

    return unsubscribe;
  }, [setPreferences, setRoomId]);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme || "midnight";
  }, [preferences.theme]);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.data() || {};
        setProfile({
          nickname: String(data.nickname || fallbackNickname(user.email)).slice(0, 24),
          email: user.email || "",
        });
      },
      () => {
        setProfile({
          nickname: fallbackNickname(user.email),
          email: user.email || "",
        });
      }
    );

    return unsubscribe;
  }, [user?.uid, user?.email]);

  useEffect(() => {
    if (!user?.uid) {
      setIsLikedGamesLoading(false);
      return undefined;
    }

    setIsLikedGamesLoading(true);
    const likedQuery = query(collection(db, "users", user.uid, "likedGames"), orderBy("likedAt", "desc"));
    const unsubscribe = onSnapshot(
      likedQuery,
      (snapshot) => {
        const nextItems = snapshot.docs.map((entry) => ({
          id: entry.id,
          ...entry.data(),
        }));
        setLikedGames(nextItems);
        setIsLikedGamesLoading(false);
      },
      () => {
        setLikedGames([]);
        setIsLikedGamesLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!roomId) {
      setRoomInfo(null);
      setRoomMembers([]);
      setRoomMatches([]);
      knownMatchIdsRef.current = new Set();
      roomMatchesReadyRef.current = false;
      return undefined;
    }

    const roomRef = doc(db, "rooms", roomId);
    const membersRef = collection(db, "rooms", roomId, "members");

    const unsubscribeRoom = onSnapshot(
      roomRef,
      (snapshot) => {
        setRoomInfo(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      },
      () => {
        setRoomInfo(null);
      }
    );

    const unsubscribeMembers = onSnapshot(
      membersRef,
      (snapshot) => {
        const members = snapshot.docs
          .map((entry) => ({
            id: entry.id,
            ...entry.data(),
          }))
          .sort((left, right) => {
            const leftStamp = left.joinedAt?.seconds || left.updatedAt?.seconds || 0;
            const rightStamp = right.joinedAt?.seconds || right.updatedAt?.seconds || 0;
            return leftStamp - rightStamp;
          });
        setRoomMembers(members);
      },
      () => {
        setRoomMembers([]);
      }
    );

    return () => {
      unsubscribeRoom();
      unsubscribeMembers();
    };
  }, [roomId]);

  const dismissToast = useCallback((id) => {
    const visibleTimeoutId = toastTimeoutsRef.current.get(id);
    if (visibleTimeoutId) {
      window.clearTimeout(visibleTimeoutId);
    }

    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)));

    const exitTimeoutId = window.setTimeout(() => {
      toastTimeoutsRef.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_EXIT_MS);
    toastTimeoutsRef.current.set(id, exitTimeoutId);
  }, []);

  const notify = useCallback(
    ({ title, description = "", tone = "neutral" }) => {
      const id = createToastId();
      setToasts((current) => [...current, { id, title, description, tone, exiting: false }]);
      const timeoutId = window.setTimeout(() => {
        dismissToast(id);
      }, TOAST_VISIBLE_MS);
      toastTimeoutsRef.current.set(id, timeoutId);
    },
    [dismissToast]
  );

  useEffect(() => {
    const toastTimeouts = toastTimeoutsRef.current;

    return () => {
      toastTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      toastTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (!roomId) {
      return undefined;
    }

    return subscribeToRoomMatches(
      roomId,
      (matches) => {
        setRoomMatches(matches);

        const nextIds = new Set(matches.map((match) => String(match.id)));
        if (roomMatchesReadyRef.current) {
          const newestMatch = matches.find((match) => !knownMatchIdsRef.current.has(String(match.id)));

          if (newestMatch) {
            notify({
              title: "Novo match!",
              description: `${newestMatch.gameName || "Um jogo"} entrou nos matches da sala.`,
              tone: "match",
            });
          }
        } else {
          roomMatchesReadyRef.current = true;
        }

        knownMatchIdsRef.current = nextIds;
      },
      () => {
        setRoomMatches([]);
      }
    );
  }, [notify, roomId]);

  const saveProfile = useCallback(
    async (nicknameInput) => {
      if (!user?.uid) {
        return;
      }

      const nickname = String(nicknameInput || "")
        .trim()
        .slice(0, 24);
      if (!nickname) {
        throw new Error("Defina um apelido para continuar.");
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          nickname,
          email: user.email || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (roomId) {
        await setDoc(
          doc(db, "rooms", roomId, "members", user.uid),
          {
            nickname,
            email: user.email || null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    },
    [roomId, user?.email, user?.uid]
  );

  const addLikedGame = useCallback(
    async (game) => {
      if (!user?.uid || !game?.id) {
        return;
      }

      const payload = {
        id: String(game.id),
        name: game.name || "",
        cover: resolveGameCover(game),
        shortDesc: game.shortDesc || "",
        genres: Array.isArray(game.genres) ? game.genres : [],
        releaseDate: game.releaseDate || "",
        esrb: game.esrb || null,
        rating: Number(game.rating || 0),
        likedAt: Date.now(),
        updatedAt: serverTimestamp(),
      };

      let insertedOptimistically = false;

      setLikedGames((current) => {
        if (current.some((item) => String(item.id) === String(game.id))) {
          return current;
        }

        insertedOptimistically = true;
        return [payload, ...current];
      });

      try {
        await setDoc(doc(db, "users", user.uid, "likedGames", String(game.id)), payload, { merge: true });
      } catch (error) {
        if (insertedOptimistically) {
          setLikedGames((current) => current.filter((item) => String(item.id) !== String(game.id)));
        }

        throw error;
      }
    },
    [user?.uid]
  );

  const removeLikedGame = useCallback(
    async (gameId) => {
      if (!user?.uid || !gameId) {
        return;
      }

      let removedGame = null;

      setLikedGames((current) => {
        removedGame = current.find((item) => String(item.id) === String(gameId)) || null;
        return current.filter((item) => String(item.id) !== String(gameId));
      });

      try {
        await deleteDoc(doc(db, "users", user.uid, "likedGames", String(gameId)));
      } catch (error) {
        if (removedGame) {
          setLikedGames((current) =>
            current.some((item) => String(item.id) === String(gameId)) ? current : [removedGame, ...current]
          );
        }

        throw error;
      }

      setDeckRefreshToken(Date.now());
    },
    [user?.uid]
  );

  const logout = useCallback(async () => {
    setRoomId("");
    setPreferences(defaultPreferences);
    await signOut(auth);
  }, [setPreferences, setRoomId]);

  const setActiveRoom = useCallback(
    (nextRoomId) => {
      setRoomId(normalizeRoomId(nextRoomId));
    },
    [setRoomId]
  );

  const updatePreferences = useCallback(
    (partial) => {
      setPreferences((current) => ({
        ...current,
        ...partial,
      }));
    },
    [setPreferences]
  );

  const toggleTheme = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      theme: current.theme === "midnight" ? "daybreak" : "midnight",
    }));
  }, [setPreferences]);

  const isLiked = useCallback(
    (gameId) => likedGames.some((item) => String(item.id) === String(gameId)),
    [likedGames]
  );

  const room = useMemo(() => (roomId ? { id: roomId } : null), [roomId]);

  const value = useMemo(
    () => ({
      authReady,
      user,
      profile,
      likedGames,
      isLikedGamesLoading,
      deckRefreshToken,
      room,
      roomInfo,
      roomMembers,
      roomMatches,
      preferences,
      toasts,
      notify,
      addLikedGame,
      removeLikedGame,
      saveProfile,
      logout,
      setActiveRoom,
      updatePreferences,
      toggleTheme,
      isLiked,
    }),
    [
      addLikedGame,
      authReady,
      deckRefreshToken,
      isLiked,
      isLikedGamesLoading,
      likedGames,
      logout,
      notify,
      preferences,
      profile,
      removeLikedGame,
      room,
      roomInfo,
      roomMatches,
      roomMembers,
      saveProfile,
      setActiveRoom,
      toasts,
      toggleTheme,
      updatePreferences,
      user,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider.");
  }

  return context;
}
