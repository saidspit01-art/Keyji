// ============================================
// KEYJI — Firebase Configuration
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDrWwIDh_Y8Fji0KWiVbR2EcmUHl5c6mHM",
  authDomain: "keyji-974fb.firebaseapp.com",
  projectId: "keyji-974fb",
  storageBucket: "keyji-974fb.firebasestorage.app",
  messagingSenderId: "442818696289",
  appId: "1:442818696289:web:5ed15e6e31fb85ef2bc620",
  measurementId: "G-XYKP587Y58"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// ============================================
// AUTH
// ============================================

export async function register(email, password, name, username) {
  try {
    const usernameClean = username.replace('@','').toLowerCase();
    const existing = await checkUsername(usernameClean);
    if (existing) throw new Error('Юзернейм уже занят');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      name,
      username: usernameClean,
      email,
      bio: '',
      country: '',
      phone: '',
      avatar: '',
      photos: [],
      verified: false,
      frozen: false,
      hideEmail: false,
      hideCountry: true,
      hideOnline: false,
      twoFactor: false,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      online: true,
      lang: localStorage.getItem('keyji_lang') || 'ru'
    });
    return { success: true, user: cred.user };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function login(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await updateDoc(doc(db, 'users', cred.user.uid), {
      online: true,
      lastSeen: serverTimestamp()
    });
    return { success: true, user: cred.user };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      const username = 'user' + Math.floor(Math.random()*99999);
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: user.displayName || 'User',
        username,
        email: user.email,
        bio: '',
        avatar: user.photoURL || '',
        photos: [],
        verified: false,
        frozen: false,
        hideEmail: false,
        hideCountry: true,
        hideOnline: false,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        online: true,
        lang: localStorage.getItem('keyji_lang') || 'ru'
      });
    }
    return { success: true, user };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function logout() {
  if (auth.currentUser) {
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      online: false,
      lastSeen: serverTimestamp()
    });
  }
  await signOut(auth);
  window.location.href = 'index.html';
}

export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// ============================================
// USERS
// ============================================

export async function getUser(uid) {
  const d = await getDoc(doc(db, 'users', uid));
  return d.exists() ? d.data() : null;
}

export async function updateUser(uid, data) {
  await updateDoc(doc(db, 'users', uid), data);
}

export async function checkUsername(username) {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function searchUsers(q) {
  const snap = await getDocs(collection(db, 'users'));
  const results = [];
  snap.forEach(d => {
    const u = d.data();
    if (
      u.username?.toLowerCase().includes(q.toLowerCase()) ||
      u.name?.toLowerCase().includes(q.toLowerCase())
    ) results.push(u);
  });
  return results;
}

// ============================================
// MESSAGES
// ============================================

export async function sendMessage(chatId, senderId, text, type='text', fileUrl='', replyTo=null) {
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderId, text, type, fileUrl, replyTo,
    timestamp: serverTimestamp(),
    status: 'sent',
    edited: false,
    reactions: {},
    autoDeleteAt: null
  });
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: text || type,
    lastMessageTime: serverTimestamp(),
    lastSenderId: senderId
  });
}

export function listenMessages(chatId, callback) {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('timestamp', 'asc'),
    limit(100)
  );
  return onSnapshot(q, snap => {
    const msgs = [];
    snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
    callback(msgs);
  });
}

export function listenChats(uid, callback) {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid),
    orderBy('lastMessageTime', 'desc')
  );
  return onSnapshot(q, snap => {
    const chats = [];
    snap.forEach(d => chats.push({ id: d.id, ...d.data() }));
    callback(chats);
  });
}

export async function deleteMessage(chatId, msgId, forEveryone=false) {
  if (forEveryone) {
    await updateDoc(doc(db, 'chats', chatId, 'messages', msgId), {
      text: 'Сообщение удалено',
      type: 'deleted',
      fileUrl: ''
    });
  } else {
    await updateDoc(doc(db, 'chats', chatId, 'messages', msgId), {
      deletedFor: auth.currentUser?.uid
    });
  }
}

export async function editMessage(chatId, msgId, newText) {
  await updateDoc(doc(db, 'chats', chatId, 'messages', msgId), {
    text: newText,
    edited: true
  });
}

export async function createChat(uid1, uid2) {
  const chatId = [uid1, uid2].sort().join('_');
  const existing = await getDoc(doc(db, 'chats', chatId));
  if (!existing.exists()) {
    await setDoc(doc(db, 'chats', chatId), {
      participants: [uid1, uid2],
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      type: 'private'
    });
  }
  return chatId;
}

// ============================================
// SAKURA PETALS 🌸
// ============================================
export function spawnSakuraPetals(count=20) {
  if (!document.getElementById('keyjiFallStyle')) {
    const style = document.createElement('style');
    style.id = 'keyjiFallStyle';
    style.textContent = `@keyframes keyjiFall {
      0% { transform: translateY(0) rotate(0deg); opacity:1; }
      100% { transform: translateY(110vh) rotate(720deg); opacity:0; }
    }`;
    document.head.appendChild(style);
  }
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.style.cssText = `
        position:fixed; z-index:9999; pointer-events:none;
        font-size:${12+Math.random()*16}px;
        left:${Math.random()*100}vw;
        top:-30px;
        animation: keyjiFall ${2+Math.random()*3}s linear forwards;
      `;
      p.textContent = ['🌸','🌺','🍃','✨'][Math.floor(Math.random()*4)];
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 5000);
    }, i * 100);
  }
}

// ============================================
// FILE UPLOAD
// ============================================
export async function uploadFile(file, path) {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

// ============================================
// ADMIN
// ============================================
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  const users = [];
  snap.forEach(d => users.push(d.data()));
  return users;
}

export async function freezeAccount(uid, frozen) {
  await updateDoc(doc(db, 'users', uid), { frozen });
}

export async function giveVerification(uid) {
  await updateDoc(doc(db, 'users', uid), { verified: true });
}

export async function checkAdminPassword(inputPassword) {
  const d = await getDoc(doc(db, 'admin', 'config'));
  if (!d.exists()) return false;
  return d.data().password === inputPassword;
}

export { auth, db, storage };
