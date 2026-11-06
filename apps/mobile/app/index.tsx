import { Redirect } from 'expo-router';
// First run goes to the date. Codex task 1: go straight to /plan once a date (or
// "not set yet") is saved on this phone.
export default function Start() { return <Redirect href="/welcome" />; }
