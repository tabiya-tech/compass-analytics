import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/_test_utilities/test-utils";
import { TEST_CONTAINER_WIDTH } from "@/test/setup";
import { useMeasure } from "./use-measure";

const PROBE_TEST_ID = "use-measure-probe";

// A minimal consumer, so the hook is exercised the way a chart uses it.
function Probe() {
  const [ref, width] = useMeasure<HTMLDivElement>();
  return (
    <div ref={ref}>
      <span data-testid={PROBE_TEST_ID}>{width}</span>
    </div>
  );
}

describe("useMeasure", () => {
  it("should report the width of the container it is attached to", () => {
    // GIVEN a component that measures its own container
    // WHEN it is rendered
    render(<Probe />);

    // THEN it reports the container's rendered width, so a chart can size its marks
    expect(screen.getByTestId(PROBE_TEST_ID)).toHaveTextContent(String(TEST_CONTAINER_WIDTH));
  });

  it("should report no width when the environment cannot measure", () => {
    // GIVEN an environment with no ResizeObserver
    const originalResizeObserver = window.ResizeObserver;
    vi.stubGlobal("ResizeObserver", undefined);

    // WHEN a measuring component is rendered
    render(<Probe />);

    // THEN it reports zero rather than throwing, and the chart skips its marks
    expect(screen.getByTestId(PROBE_TEST_ID)).toHaveTextContent("0");

    vi.stubGlobal("ResizeObserver", originalResizeObserver);
  });

  it("should stop observing once the component is gone", () => {
    // GIVEN a measuring component that is observing its container
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect = disconnect;
      }
    );
    const { unmount } = render(<Probe />);

    // WHEN it unmounts
    unmount();

    // THEN the observer is disconnected, so nothing is left watching a detached node
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
