import { registerFont } from './font';
import { isPageIgnored } from './settings';

// Never register extension styles on a page the user has excluded.
void isPageIgnored().then((ignored) => {
  if (!ignored) {
    registerFont(document);
  }
});
