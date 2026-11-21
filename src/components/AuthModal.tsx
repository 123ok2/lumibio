import { useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { CheckCircle2, Mail, RefreshCw, X } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void | Promise<void>;
  initialMode?: 'login' | 'register';
  needsVerificationUser?: {
    email: string | null;
  } | null;
}

function mapFirebaseAuthError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Email này đã được đăng ký. Vui lòng chuyển sang tab Đăng nhập.';
    case 'auth/invalid-email':
      return 'Địa chỉ email không hợp lệ.';
    case 'auth/weak-password':
      return 'Mật khẩu cần tối thiểu 6 ký tự.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email hoặc mật khẩu chưa chính xác.';
    case 'auth/popup-closed-by-user':
      return 'Bạn đã đóng cửa sổ đăng nhập Google.';
    case 'auth/operation-not-allowed':
      return 'Phương thức Email/Mật khẩu chưa được bật trong Firebase Console (Authentication → Sign-in method → Email/Password). Bạn có thể bật tại Console hoặc dùng Đăng nhập Google ngay bên trên.';
    case 'auth/too-many-requests':
      return 'Thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
    default:
      return 'Không thể xác thực tài khoản lúc này. Vui lòng thử lại.';
  }
}

export function AuthModal({
  isOpen,
  onClose,
  onAuthenticated,
  initialMode = 'register',
  needsVerificationUser,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      await onAuthenticated();
      onClose();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code) {
        setErrorMsg(mapFirebaseAuthError(code));
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Không thể hoàn tất đăng nhập.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      if (mode === 'register') {
        const cleanName = displayName.trim() || email.split('@')[0] || 'Creator';
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: cleanName.slice(0, 60) });
        await sendEmailVerification(cred.user);
        setInfoMsg(
          'Tài khoản đã được tạo! Hãy kiểm tra hộp thư để xác thực email, sau đó nhấn "Tôi đã xác thực".'
        );
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (cred.user.emailVerified) {
          await onAuthenticated();
          onClose();
        } else {
          setInfoMsg(
            'Tài khoản của bạn chưa xác thực email. Vui lòng kiểm tra hộp thư hoặc gửi lại liên kết xác thực.'
          );
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      setErrorMsg(mapFirebaseAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setErrorMsg('');
    setLoading(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setInfoMsg('Đã gửi lại email xác thực. Vui lòng kiểm tra cả thư mục Spam.');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      setErrorMsg(mapFirebaseAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerified = async () => {
    if (!auth.currentUser) return;
    setErrorMsg('');
    setLoading(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        await onAuthenticated();
        onClose();
      } else {
        setErrorMsg('Email vẫn chưa được xác thực. Vui lòng nhấn vào liên kết trong hộp thư của bạn.');
      }
    } catch {
      setErrorMsg('Không thể kiểm tra trạng thái xác thực lúc này.');
    } finally {
      setLoading(false);
    }
  };

  const showVerificationScreen = Boolean(needsVerificationUser && auth.currentUser && !auth.currentUser.emailVerified);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-white border border-[#E5E3DC] rounded-2xl max-w-md w-full p-6 sm:p-8 relative shadow-lg">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-lg flex items-center justify-center text-[#575652] hover:text-[#141413] hover:bg-[#F3F2EE] transition-colors cursor-pointer"
          aria-label="Đóng hộp thoại"
        >
          <X className="w-4 h-4" />
        </button>

        {showVerificationScreen ? (
          <div>
            <div className="w-11 h-11 rounded-xl bg-[#FF4D2D]/10 text-[#FF4D2D] flex items-center justify-center mb-4">
              <Mail className="w-5 h-5" />
            </div>
            <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight mb-2">
              Xác thực email tài khoản
            </h2>
            <p className="text-sm text-[#575652] leading-relaxed mb-5">
              Để bảo mật dữ liệu trang Bio trên Firebase, vui lòng xác thực địa chỉ email{' '}
              <span className="font-semibold text-[#141413]">{auth.currentUser?.email}</span> qua liên kết đã gửi.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {errorMsg}
              </div>
            )}
            {infoMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {infoMsg}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={handleCheckVerified}
                className="w-full py-2.5 px-4 rounded-xl bg-[#141413] text-white text-sm font-semibold hover:bg-[#2B2B29] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Tôi đã xác thực email
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleResendVerification}
                className="w-full py-2.5 px-4 rounded-xl bg-[#F3F2EE] text-[#141413] text-sm font-medium hover:bg-[#E8E6DF] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Gửi lại email xác thực
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 rounded-xl border border-[#E5E3DC] text-[#141413] text-sm font-medium hover:bg-[#FAFAF8] transition-colors cursor-pointer mt-1"
              >
                Hoặc đăng nhập nhanh bằng Google
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 id="auth-modal-title" className="text-2xl font-bold tracking-tight mb-1.5">
              {mode === 'register' ? 'Tạo tài khoản LumiBio' : 'Đăng nhập LumiBio'}
            </h2>
            <p className="text-sm text-[#575652] mb-6">
              Lưu trữ trang Bio và thống kê lượt nhấn an toàn trên đám mây Firebase.
            </p>

            {/* Google Quick Login */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 rounded-xl border border-[#E5E3DC] bg-white hover:bg-[#FAFAF8] text-sm font-semibold text-[#141413] transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              Tiếp tục với Google
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="h-px bg-[#E5E3DC] flex-1" />
              <span className="text-xs text-[#787670]">hoặc bằng Email</span>
              <div className="h-px bg-[#E5E3DC] flex-1" />
            </div>

            {/* Segmented Mode Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3F2EE] rounded-xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#575652] hover:text-[#141413]'
                }`}
              >
                Đăng ký mới
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#575652] hover:text-[#141413]'
                }`}
              >
                Đã có tài khoản
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
                {errorMsg}
              </div>
            )}
            {infoMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed">
                {infoMsg}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-semibold text-[#141413] mb-1.5">
                    Tên hiển thị
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    maxLength={60}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ví dụ: Thảo Linh"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E3DC] bg-[#FAFAF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D2D]/30 focus:border-[#FF4D2D]"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-semibold text-[#141413] mb-1.5">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  maxLength={200}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@domain.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E3DC] bg-[#FAFAF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D2D]/30 focus:border-[#FF4D2D]"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-semibold text-[#141413] mb-1.5">
                  Mật khẩu
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E3DC] bg-[#FAFAF8] text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4D2D]/30 focus:border-[#FF4D2D]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#FF4D2D] hover:bg-[#E63E20] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 mt-2"
              >
                {loading
                  ? 'Đang xử lý...'
                  : mode === 'register'
                    ? 'Đăng ký tài khoản'
                    : 'Đăng nhập'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
