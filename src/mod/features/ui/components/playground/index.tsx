
import GeniusApiTester from "./genius-api-tester";
import MusixmatchApiTester from "./musixmatch-api-tester";
import PlayerStateTester from "./player-state-tester";

export function Playground() {
  return (
    <>
      <PlayerStateTester />
      <GeniusApiTester />
      <MusixmatchApiTester />
    </>
  );
}
