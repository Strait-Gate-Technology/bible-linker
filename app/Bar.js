import BrandLink from "./BrandLink";
import Navigator from "./Navigator";
import { getNavData } from "../lib/bible";
import BackToResults from "./BackToResults";
import SearchBox from "./SearchBox";
import SizeStepper from "./SizeStepper";
import RedLetterToggle from "./RedLetterToggle";
import FontSelect from "./FontSelect";
import VersionSelect from "./VersionSelect";
import ResetButton from "./ResetButton";

// The top bar, shared by the reading page and the search results page.
export default async function Bar({ current, version, query, showBack = false }) {
  const books = await getNavData(version);
  return (
    <header className="bar">
      <BrandLink />
      {showBack && <BackToResults />}
      <SearchBox defaultValue={query} />
      <div className="tools">
        <VersionSelect current={version} />
        <ResetButton version={version} />
        <FontSelect />
        <SizeStepper />
        <RedLetterToggle />
        <Navigator books={books} current={current} />
      </div>
    </header>
  );
}
