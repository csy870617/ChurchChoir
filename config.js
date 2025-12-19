import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBNh4M-nIOKOM5IdSerRFnoHHpyqNkfULA",
    authDomain: "churchchoir-a6099.firebaseapp.com",
    projectId: "churchchoir-a6099",
    storageBucket: "churchchoir-a6099.firebasestorage.app",
    messagingSenderId: "618743210216",
    appId: "1:618743210216:web:565f2c21b911840a26295d",
    measurementId: "G-2R5QJVR77G"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const groupsCollection = collection(db, "choir_groups"); 
const boardCollection = collection(db, "choir_posts");
const sharedLinksCollection = collection(db, "shared_links");
const groupLinksCollection = collection(db, "group_links");

export { db, auth, groupsCollection, boardCollection, sharedLinksCollection, groupLinksCollection };