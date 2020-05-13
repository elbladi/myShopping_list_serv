let firebase = require('firebase/app');
require('firebase/database');

const firebaseConfig = {
    apiKey: process.env.API_KEY,
    authDomain: process.env.AUTH_DOMAIN,
    databaseURL: process.env.URL,
    projectId: process.env.PROJECT_ID,
    storageBucket: process.env.BUCKET,
    messagingSenderId: process.env.MESS_ID,
    appId: process.env.APP_ID
};
let app = firebase.initializeApp(firebaseConfig);

exports.firebase = app;