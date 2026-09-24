import Home from '../components/Home';
import en from '../content/en';

export default function IndexPage(props) {
  return <Home content={en} {...props} />;
}
