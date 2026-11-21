import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Đã xảy ra lỗi ngoài ý muốn.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let displayDetail = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage) as { error?: string; operationType?: string; path?: string };
        if (parsed.error) {
          displayDetail = `${parsed.error}${parsed.path ? ` (${parsed.operationType} · ${parsed.path})` : ''}`;
        }
      } catch {
        // Plain error message
      }

      return (
        <div className="min-h-screen bg-[#FAFAF8] text-[#141413] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E5E3DC] rounded-2xl p-8">
            <div className="w-11 h-11 rounded-xl bg-[#FF4D2D]/10 text-[#FF4D2D] flex items-center justify-center mb-5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight mb-2">Không thể tải dữ liệu</h1>
            <p className="text-sm text-[#575652] leading-relaxed mb-5">
              Hệ thống gặp sự cố kết nối hoặc phân quyền. Vui lòng thử tải lại trang hoặc kiểm tra trạng thái đăng nhập.
            </p>
            <div className="bg-[#F3F2EE] rounded-lg p-3 text-xs font-mono text-[#575652] break-words mb-6">
              {displayDetail}
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#141413] text-white text-sm font-semibold hover:bg-[#2B2B29] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Quay về trang chủ
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
