import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { resolveGameCover } from "../utils/gameMedia";
import { normalizeRoomId } from "../utils/validators";

const MIN_MATCH_MEMBERS = 2;

function createRoomId(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";

  for (let index = 0; index < length; index += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return output;
}

function normalizeMemberIds(ids = []) {
  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
}

function getStoredMemberIds(roomData, fallbackIds = []) {
  const storedIds = Array.isArray(roomData.memberIds) ? roomData.memberIds : [];
  return normalizeMemberIds(storedIds.length ? storedIds : fallbackIds);
}

async function upsertNicknameProfile(user, nickname) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      nickname,
      email: user.email || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createRoom({ user, nickname, maxMembers, timerSeconds = 0 }) {
  if (!user?.uid) {
    throw new Error("Você precisa estar autenticado para criar uma sala.");
  }

  const roomId = createRoomId();
  const roomRef = doc(db, "rooms", roomId);
  const memberRef = doc(db, "rooms", roomId, "members", user.uid);

  const normalizedTimer = Math.max(0, Math.min(120, Number(timerSeconds) || 0));

  await setDoc(roomRef, {
    createdBy: user.uid,
    createdByEmail: user.email || null,
    createdAt: serverTimestamp(),
    maxMembers,
    memberCount: 1,
    memberIds: [user.uid],
    timerSeconds: normalizedTimer,
  });

  await setDoc(memberRef, {
    joined: true,
    joinedAt: serverTimestamp(),
    nickname,
    email: user.email || null,
    role: "host",
  });

  await upsertNicknameProfile(user, nickname);
  return roomId;
}

export async function joinRoom({ roomId, user, nickname }) {
  if (!user?.uid) {
    throw new Error("Você precisa estar autenticado para entrar em uma sala.");
  }

  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId) {
    throw new Error("Informe um código de sala válido.");
  }

  const roomRef = doc(db, "rooms", normalizedRoomId);
  const memberRef = doc(db, "rooms", normalizedRoomId, "members", user.uid);

  await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef);

    if (!roomSnapshot.exists()) {
      throw new Error("Sala não encontrada.");
    }

    const roomData = roomSnapshot.data() || {};
    const maxMembers = Number(roomData.maxMembers || 0);
    const memberCount = Number(roomData.memberCount || 0);
    const memberSnapshot = await transaction.get(memberRef);
    const memberIds = getStoredMemberIds(roomData, roomData.createdBy ? [roomData.createdBy] : []);
    const currentMemberCount = Math.max(memberCount, memberIds.length);
    const nextMemberIds = memberIds.includes(user.uid) ? memberIds : [...memberIds, user.uid];

    if (!memberSnapshot.exists() && maxMembers && currentMemberCount >= maxMembers) {
      throw new Error("Esta sala já está lotada.");
    }

    transaction.set(
      memberRef,
      {
        joined: true,
        joinedAt: serverTimestamp(),
        nickname,
        email: user.email || null,
        role: roomData.createdBy === user.uid ? "host" : "member",
      },
      { merge: true }
    );

    if (!memberSnapshot.exists()) {
      transaction.update(roomRef, {
        memberCount: Math.max(currentMemberCount + 1, nextMemberIds.length),
        memberIds: nextMemberIds,
      });
    } else if (!memberIds.includes(user.uid)) {
      transaction.update(roomRef, {
        memberCount: Math.max(currentMemberCount, nextMemberIds.length),
        memberIds: nextMemberIds,
      });
    }
  });

  await upsertNicknameProfile(user, nickname);
  return normalizedRoomId;
}

export async function leaveRoom({ roomId, userId }) {
  if (!roomId || !userId) {
    return;
  }

  const roomRef = doc(db, "rooms", roomId);
  const memberRef = doc(db, "rooms", roomId, "members", userId);

  const result = await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) {
      return { shouldCleanupRoom: false };
    }

    const memberSnapshot = await transaction.get(memberRef);
    const roomData = roomSnapshot.data() || {};
    const memberCount = Number(roomData.memberCount || 0);
    const memberExists = memberSnapshot.exists();
    if (!memberExists) {
      return { shouldCleanupRoom: false };
    }

    const memberIds = getStoredMemberIds(roomData, memberExists ? [userId] : []);
    const nextMemberIds = memberIds.filter((memberId) => memberId !== userId);
    const nextMemberCount = Math.max(0, Math.max(memberCount, memberIds.length) - (memberExists ? 1 : 0));
    const isHostLeaving = roomData.createdBy === userId;
    const nextHostId = isHostLeaving ? nextMemberIds[0] : "";
    const nextHostRef = nextHostId ? doc(db, "rooms", roomId, "members", nextHostId) : null;
    const nextHostSnapshot = nextHostRef ? await transaction.get(nextHostRef) : null;

    if (memberExists) {
      transaction.delete(memberRef);
    }

    if (nextMemberCount === 0 || (isHostLeaving && !nextHostId)) {
      transaction.delete(roomRef);
      return { shouldCleanupRoom: true };
    }

    if (isHostLeaving) {
      transaction.update(roomRef, {
        createdBy: nextHostId,
        createdByEmail: nextHostSnapshot?.data()?.email || null,
        memberCount: nextMemberCount,
        memberIds: nextMemberIds,
      });
      transaction.set(
        nextHostRef,
        {
          role: "host",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return { shouldCleanupRoom: false };
    }

    transaction.update(roomRef, {
      memberCount: nextMemberCount,
      memberIds: nextMemberIds,
    });

    return { shouldCleanupRoom: false };
  });

  if (result.shouldCleanupRoom) {
    await deleteRoomSubcollections(roomId);
  }
}

export async function updateRoomTimer({ roomId, userId, timerSeconds }) {
  if (!roomId || !userId) {
    return;
  }

  const normalizedTimer = Math.max(0, Math.min(120, Number(timerSeconds) || 0));
  const roomRef = doc(db, "rooms", roomId);

  await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) {
      throw new Error("Sala não encontrada.");
    }

    const roomData = roomSnapshot.data() || {};
    if (roomData.createdBy !== userId) {
      throw new Error("Apenas o host pode alterar a rodada rápida.");
    }

    transaction.update(roomRef, {
      timerSeconds: normalizedTimer,
    });
  });
}

async function deleteCollectionDocs(collectionRef) {
  const snapshot = await getDocs(collectionRef);
  if (snapshot.empty) {
    return;
  }

  const batch = writeBatch(db);
  snapshot.forEach((entry) => batch.delete(entry.ref));
  await batch.commit();
}

async function deleteRoomSubcollections(roomId) {
  await Promise.all([
    deleteCollectionDocs(collection(db, "rooms", roomId, "members")),
    deleteCollectionDocs(collection(db, "rooms", roomId, "votes")),
    deleteCollectionDocs(collection(db, "rooms", roomId, "matches")),
  ]);
}

async function persistMatchHistory({ roomId, game, likedBy }) {
  const membersSnapshot = await getDocs(collection(db, "rooms", roomId, "members"));
  const nicknameByUid = {};
  const gameCover = resolveGameCover(game);
  const totalMembers = membersSnapshot.size;

  membersSnapshot.forEach((memberDoc) => {
    const memberData = memberDoc.data() || {};
    nicknameByUid[memberDoc.id] =
      String(memberData.nickname || "").trim() || String(memberData.email || "").split("@")[0] || "jogador";
  });

  const likedByNames = likedBy.map((uid) => nicknameByUid[uid] || `user-${uid.slice(0, 6)}`);
  const matchRef = doc(db, "rooms", roomId, "matches", String(game.id));

  await setDoc(
    matchRef,
    {
      gameId: String(game.id),
      gameName: game.name,
      gameCover,
      likedBy,
      likedByNames,
      totalMembers,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  await Promise.all(
    likedBy.map((memberUid) =>
      setDoc(
        doc(db, "users", memberUid, "matchHistory", `${roomId}_${game.id}`),
        {
          roomId,
          gameId: String(game.id),
          gameName: game.name,
          gameCover,
          likedBy,
          likedByNames,
          matchedWith: likedBy.filter((uid) => uid !== memberUid),
          totalMembers,
          folderName: `Sala ${roomId}`,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}

export async function castVote({ roomId, user, game, action }) {
  if (!roomId || !user?.uid || !game?.id) {
    return;
  }

  if (!["like", "pass"].includes(action)) {
    throw new Error("Voto invalido.");
  }

  const roomRef = doc(db, "rooms", roomId);
  const memberRef = doc(db, "rooms", roomId, "members", user.uid);
  const voteRef = doc(db, "rooms", roomId, "votes", String(game.id));
  const gameCover = resolveGameCover(game);

  const result = await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef);
    if (!roomSnapshot.exists()) {
      throw new Error("Sala nao encontrada.");
    }

    const memberSnapshot = await transaction.get(memberRef);
    if (!memberSnapshot.exists()) {
      throw new Error("Entre na sala antes de votar.");
    }

    const snapshot = await transaction.get(voteRef);
    const roomData = roomSnapshot.data() || {};
    const storedMemberIds = getStoredMemberIds(roomData, [user.uid]);
    const activeMemberIds = storedMemberIds.includes(user.uid)
      ? storedMemberIds
      : [...storedMemberIds, user.uid];
    const activeMemberSet = new Set(activeMemberIds);
    const currentData = snapshot.exists()
      ? snapshot.data()
      : {
          likedBy: [],
          passedBy: [],
        };

    const likedBy = normalizeMemberIds(Array.isArray(currentData.likedBy) ? currentData.likedBy : []).filter(
      (uid) => activeMemberSet.has(uid)
    );
    const passedBy = normalizeMemberIds(
      Array.isArray(currentData.passedBy) ? currentData.passedBy : []
    ).filter((uid) => activeMemberSet.has(uid));
    const uid = user.uid;
    let nextLikedBy = likedBy;
    let nextPassedBy = passedBy;

    if (action === "like") {
      if (!likedBy.includes(uid)) {
        nextLikedBy = [...likedBy, uid];
      }

      if (passedBy.includes(uid)) {
        nextPassedBy = passedBy.filter((entry) => entry !== uid);
      }
    } else {
      if (!passedBy.includes(uid)) {
        nextPassedBy = [...passedBy, uid];
      }

      if (likedBy.includes(uid)) {
        nextLikedBy = likedBy.filter((entry) => entry !== uid);
      }
    }

    transaction.set(
      voteRef,
      {
        gameId: String(game.id),
        gameName: game.name,
        gameCover,
        likedBy: nextLikedBy,
        memberIds: activeMemberIds,
        passedBy: nextPassedBy,
        requiredLikes: activeMemberIds.length,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return {
      likedBy: nextLikedBy,
      activeMemberIds,
    };
  });

  const activeLikedBy = result.likedBy.filter((uid) => result.activeMemberIds.includes(uid));
  const hasGroupMatch =
    action === "like" &&
    result.activeMemberIds.length >= MIN_MATCH_MEMBERS &&
    activeLikedBy.length >= result.activeMemberIds.length;

  if (hasGroupMatch) {
    const matchRef = doc(db, "rooms", roomId, "matches", String(game.id));
    const matchSnapshot = await getDoc(matchRef);

    if (!matchSnapshot.exists()) {
      await persistMatchHistory({
        roomId,
        game,
        likedBy: activeLikedBy,
      });
    }
  }
}

export function subscribeToRoomMatches(roomId, onValue, onError) {
  if (!roomId) {
    onValue([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, "rooms", roomId, "matches"),
    (snapshot) => {
      const data = snapshot.docs
        .map((entry) => ({
          id: entry.id,
          ...entry.data(),
        }))
        .sort((left, right) => (right.createdAt?.seconds || 0) - (left.createdAt?.seconds || 0));
      onValue(data);
    },
    onError
  );
}

export function subscribeToUserMatchHistory(userId, onValue, onError) {
  if (!userId) {
    onValue([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, "users", userId, "matchHistory"),
    (snapshot) => {
      const data = snapshot.docs
        .map((entry) => ({
          id: entry.id,
          ...entry.data(),
        }))
        .sort((left, right) => (right.createdAt?.seconds || 0) - (left.createdAt?.seconds || 0));
      onValue(data);
    },
    onError
  );
}

export async function deleteUserRoomMatchHistory({ userId, roomId }) {
  if (!userId || !roomId) {
    return 0;
  }

  const historyQuery = query(collection(db, "users", userId, "matchHistory"), where("roomId", "==", roomId));
  const snapshot = await getDocs(historyQuery);

  if (snapshot.empty) {
    return 0;
  }

  let deletedCount = 0;
  let batch = writeBatch(db);
  let pendingWrites = 0;

  for (const entry of snapshot.docs) {
    batch.delete(entry.ref);
    deletedCount += 1;
    pendingWrites += 1;

    if (pendingWrites >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      pendingWrites = 0;
    }
  }

  if (pendingWrites) {
    await batch.commit();
  }

  return deletedCount;
}

export async function getRoomSnapshot(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "rooms", normalizedRoomId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}
