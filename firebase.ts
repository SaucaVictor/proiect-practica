import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDbmX_Fvm1b6vZ78MYS-ad5ZsxG7-G0MCc",
  authDomain: "classroom-tutu.firebaseapp.com",
  projectId: "classroom-tutu",
  storageBucket: "classroom-tutu.firebasestorage.app",
  messagingSenderId: "310581180946",
  appId: "1:310581180946:web:211a4b7887f6f452acb6cb",
  measurementId: "G-TZJRPJG3MJ"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);