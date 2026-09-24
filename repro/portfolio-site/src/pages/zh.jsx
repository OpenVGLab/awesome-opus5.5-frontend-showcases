import Home from '../components/Home';
import zh from '../content/zh';

export default function ChinesePage(props) {
  return <Home content={zh} {...props} />;
}
