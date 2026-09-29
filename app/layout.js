import "@fontsource-variable/roboto/wght.css";
import "@fontsource-variable/literata/wght.css";
import "@fontsource-variable/crimson-pro/wght.css";
import "@fontsource-variable/source-sans-3/wght.css";
import "@fontsource-variable/noto-serif/wght.css";
import "./globals.css";
import TabToSearch from "./TabToSearch";
import HelpOverlay from "./HelpOverlay";

export const metadata = {
  title: "Bible Linker 📚",
  description: "Read scripture as it appears, one word at a time.",
};

// Apply saved text size, font and red letter setting before first paint so the page never jumps.
const applySavedSize = `try{
  var s=parseInt(localStorage.getItem("bible-linker:size"),10);
  if(s>=12&&s<=48)document.documentElement.style.setProperty("--reader-size",s+"pt");
  var f={literata:'"Literata Variable", Georgia, serif',crimson:'"Crimson Pro Variable", Georgia, serif',"source-sans":'"Source Sans 3 Variable", system-ui, sans-serif',"noto-serif":'"Noto Serif Variable", Georgia, serif'}[localStorage.getItem("bible-linker:font")];
  if(f)document.documentElement.style.setProperty("--reader-font",f);
  localStorage.removeItem("bible-linker:align");
  if(localStorage.getItem("bible-linker:red")==="on")document.documentElement.classList.add("redletter");
  localStorage.removeItem("bible-linker:speed");
  localStorage.removeItem("bible-linker:grow");
}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySavedSize }} />
      </head>
      <body>
        <TabToSearch />
        {children}
        <HelpOverlay />
      </body>
    </html>
  );
}
