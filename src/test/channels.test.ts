import { describe, it, expect } from "vitest";
import { getChannelInfo } from "../utils/channels";

describe("getChannelInfo", () => {
  it("returns rich info for known channels", () => {
    const voice = getChannelInfo("conversationconductor")!;
    expect(voice.label).toBe("Voice");
    expect(voice.emoji).toBe("📞");

    const lcw = getChannelInfo("lcw")!;
    expect(lcw.label).toBe("LCW");

    const auto = getChannelInfo("pva-autonomous")!;
    expect(auto.label).toBe("Autonomous");
  });

  it("returns a fallback ChannelInfo for unknown channels (so they still render)", () => {
    const unknown = getChannelInfo("some-future-channel")!;
    expect(unknown.id).toBe("some-future-channel");
    expect(unknown.label).toBe("some-future-channel");
    expect(unknown.emoji).toBe("📨");
  });

  it("returns undefined when channelId is missing", () => {
    expect(getChannelInfo(undefined)).toBeUndefined();
  });
});
