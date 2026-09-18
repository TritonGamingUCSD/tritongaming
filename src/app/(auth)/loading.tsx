import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

export default function AuthLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingSpinner size={36} theme="dark" />
    </div>
  );
}
