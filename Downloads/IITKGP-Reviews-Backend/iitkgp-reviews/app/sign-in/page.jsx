import { SignIn } from '../../components/sign-in.jsx';

export const metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }) {
  const raw = (await searchParams).next;
  const next = typeof raw === 'string' && /^\/(?![\\/])/.test(raw) && !/[\\\x00-\x1f]/.test(raw) ? raw : '/';
  return <div className="wrap auth-wrap"><SignIn next={next} /></div>;
}
