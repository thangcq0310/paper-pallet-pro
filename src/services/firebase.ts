// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAPj6x93P-n0Em6y7zuH_-9Mkskv0421Vk",
  authDomain: "mini-wms-a028f.firebaseapp.com",
  projectId: "mini-wms-a028f",
  storageBucket: "mini-wms-a028f.firebasestorage.app",
  messagingSenderId: "807519496265",
  appId: "1:807519496265:web:b7b5beeb2a14bdfecbb798"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
