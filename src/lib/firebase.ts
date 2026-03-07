import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, onSnapshot, orderBy } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

// Initialize Firebase only if configured
const app = isFirebaseConfigured ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]) : null as any;
export const auth = app ? getAuth(app) : null as any;
export const db = app ? getFirestore(app) : null as any;
export const googleProvider = app ? new GoogleAuthProvider() : null as any;

export const signInWithGoogle = async () => {
  if (!auth || !googleProvider) throw new Error("Firebase is not configured");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user exists in Firestore, if not create them with default interests
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        interests: [],
        vectorProfile: [], // Placeholder for future learning algorithm
        hasCompletedOnboarding: false,
        createdAt: serverTimestamp()
      });
    }
    
    return user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logClickHistory = async (userId: string, itemTitle: string, itemUrl: string, itemType: string) => {
  if (!userId || !db) return;
  
  try {
    const historyRef = collection(db, "users", userId, "history");
    await addDoc(historyRef, {
      title: itemTitle,
      url: itemUrl,
      type: itemType,
      clickedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error logging click history", error);
  }
};

export const resetProfile = async (userId: string) => {
  if (!userId || !db) return;
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      interests: [],
      vectorProfile: [],
      hasCompletedOnboarding: false
    });
  } catch (error) {
    console.error("Error resetting profile", error);
  }
};

export const toggleBookmark = async (userId: string, item: any, type: string) => {
  if (!userId || !db) return false;
  try {
    const url = type === 'news' ? item.link : type === 'video' ? `https://youtube.com/watch?v=${item.id?.videoId || item.id}` : item.url;
    const bookmarksRef = collection(db, 'users', userId, 'bookmarks');
    const q = query(bookmarksRef, where('url', '==', url));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      await deleteDoc(snapshot.docs[0].ref);
      return false; // Removed
    } else {
      await addDoc(bookmarksRef, { item, type, url, savedAt: serverTimestamp() });
      return true; // Added
    }
  } catch (error) {
    console.error("Error toggling bookmark", error);
    return false;
  }
};

export const subscribeToBookmarks = (userId: string, callback: (bookmarks: any[]) => void) => {
  if (!userId || !db) return () => {};
  const bookmarksRef = collection(db, 'users', userId, 'bookmarks');
  const q = query(bookmarksRef, orderBy('savedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

export const exportUserData = async (userId: string) => {
  if (!userId || !db) return null;
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const historyRef = collection(db, "users", userId, "history");
    const historySnap = await getDocs(historyRef);
    const history = historySnap.docs.map(doc => doc.data());

    const bookmarksRef = collection(db, "users", userId, "bookmarks");
    const bookmarksSnap = await getDocs(bookmarksRef);
    const bookmarks = bookmarksSnap.docs.map(doc => doc.data());

    const exportData = {
      profile: userData,
      history,
      bookmarks,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulseboard_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error("Error exporting user data", error);
    return false;
  }
};

export const logout = () => {
  if (auth) return signOut(auth);
};
