import PlaylistBrowser from "./PlaylistBrowser";

export default function TopTracks(props) {
  return <PlaylistBrowser {...props} initialTab="tracks" />;
}
