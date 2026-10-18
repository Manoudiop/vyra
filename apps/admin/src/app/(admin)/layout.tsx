import Link from 'next/link';
import { logout } from '../login/actions';

/** Every page here sits behind the proxy's session check. */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="topbar">
        <nav>
          <strong className="brand">VYRA Admin</strong>
          <Link href="/">Tableau de bord</Link>
          <Link href="/users">Utilisateurs</Link>
          <Link href="/subscriptions">Abonnements</Link>
        </nav>
        <form action={logout}>
          <button type="submit" className="link">
            Se déconnecter
          </button>
        </form>
      </header>
      <main>{children}</main>
    </>
  );
}
