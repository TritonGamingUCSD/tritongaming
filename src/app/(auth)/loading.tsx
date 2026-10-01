import LogoLoader from '@/components/LogoLoader/LogoLoader';

export default function AuthLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LogoLoader size={80} label="Loading sign-in…" theme="dark" />
    </div>
  );
}
