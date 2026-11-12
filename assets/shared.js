export const firebaseConfig = {
  apiKey: "AIzaSyDl5sbPsFkRCHht0_cFJv3OLTqzx1nlPqg",
  authDomain: "recrutamento-asw.firebaseapp.com",
  databaseURL: "https://recrutamento-asw-default-rtdb.firebaseio.com",
  projectId: "recrutamento-asw",
  storageBucket: "recrutamento-asw.firebasestorage.app",
  messagingSenderId: "1036486404644",
  appId: "1:1036486404644:web:02a9a23e69ef0b91b906b1",
};
// This identifies the existing staff account, not a credential. Rules enforce access.
export const ADMIN_UID = "HZ2txmi9fPVzDKvt5f5OomAi1B42";
export const $ = (id) => document.getElementById(id);
export function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = String(text);
  return element;
}
