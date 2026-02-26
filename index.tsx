import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GoogleOAuthProvider } from '@react-oauth/google';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// 주의: 실제 운영 환경에서는 Google Cloud Console에서 발급받은 유효한 Client ID를 사용해야 합니다.
// 로컬 테스트 시 'localhost'가 승인된 자바스크립트 원본으로 등록되어 있어야 합니다.
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; 

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);