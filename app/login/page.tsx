'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  not_invited: 'Tài khoản chưa được mời. Liên hệ admin để được cấp quyền.',
  pending:     'Tài khoản đang chờ duyệt. Vui lòng liên hệ admin.',
  blocked:     'Tài khoản đã bị khóa. Liên hệ admin để biết thêm.',
  OAuthAccountNotLinked: 'Email này đã được đăng ký bằng phương thức khác.',
  default:     'Đã có lỗi xảy ra. Vui lòng thử lại.',
};

function LoginContent() {
  const params = useSearchParams();
  const errorKey = params.get('error') ?? '';
  const errorMsg = errorKey
    ? (ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.default)
    : null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-6">

        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg">
            {/* Leaf icon */}
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 4C10.8 4 6 10 6 18C6 26 12 30 18 30C18 30 18 20 28 14C22 14 18 18 18 18C18 18 16 10 18 4Z"
                fill="white" fillOpacity="0.9" />
              <path d="M18 30C18 30 14 24 14 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">LoveinTea Studio</h1>
            <p className="text-sm text-gray-400 mt-0.5">Đăng nhập để tiếp tục</p>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="w-full bg-red-900/40 border border-red-700/50 rounded-lg px-4 py-3 text-sm text-red-300 text-center">
            {errorMsg}
          </div>
        )}

        {/* Google sign-in button */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 font-semibold text-sm rounded-xl px-5 py-3.5 shadow transition-colors duration-150"
        >
          {/* Google icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider info */}
        <p className="text-xs text-gray-600 text-center">
          Chỉ các thành viên được cấp quyền mới có thể truy cập
        </p>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-gray-700">loveintea.wealthpsy.com</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-600 text-sm">Đang tải...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
