import { it, describe, expect, mock, beforeEach } from "bun:test";
import extendStreamController from ".";

const mockController = {
  enqueue: mock(() => {}),
} as any;

describe("extendStreamController", () => {
  beforeEach(() => {
    mockController.enqueue.mockClear();
  });

  it("should enqueue directly the chunks without suspenseId", () => {
    const controller = extendStreamController(mockController);

    controller.startTag("<div>");
    controller.enqueue("Hello world!");
    controller.endTag("</div>");

    expect(mockController.enqueue.mock.calls).toEqual([
      ["<div>"],
      ["Hello world!"],
      ["</div>"],
    ]);
  });

  it("should not enqueue directly the suspensed chunks and do it later", async () => {
    const controller = extendStreamController(mockController);

    // Pending part before suspensed
    controller.startTag(`<div id="S:1">`);
    controller.enqueue("Loading...");
    controller.endTag("</div>");

    const suspenseId = controller.nextSuspenseIndex();
    controller.suspensePromise(Promise.resolve());

    // Another in the middle:
    controller.startTag("<div>");
    controller.enqueue("Another");

    // Finish the suspensed part in te middle of the another part
    controller.enqueue("Success!", suspenseId);

    // Finish the another part
    controller.endTag("</div>");

    await controller.waitSuspensedPromises();

    expect(mockController.enqueue.mock.calls).toEqual([
      [`<div id="S:1">`],
      ["Loading..."],
      ["</div>"],
      ["<div>"],
      ["Another"],
      ["</div>"],
      [
        `<template id="U:1">Success!</template><script id="R:1">u$('1')</script>`,
      ],
    ]);
  });

  it("should not enqueue directly the suspensed chunks and do it later with multiple suspenses", async () => {
    const controller = extendStreamController(mockController);
    const firstSuspenseId = controller.nextSuspenseIndex();
    controller.suspensePromise(Promise.resolve());
    const secondSuspenseId = controller.nextSuspenseIndex();
    controller.suspensePromise(Promise.resolve());

    controller.startTag(`<div id="S:1">`);
    controller.enqueue("Loading...");
    controller.endTag("</div>");

    controller.startTag(`<div id="S:2">`);
    controller.enqueue("Loading...");
    controller.endTag("</div>");

    controller.startTag("<h1>");
    controller.enqueue("Hello world");

    controller.startTag("<div>", secondSuspenseId);
    controller.enqueue("Success U2!", secondSuspenseId);
    controller.endTag("</div>", secondSuspenseId);

    controller.endTag("</h1>");
    controller.enqueue("Success U1!", firstSuspenseId);

    await controller.waitSuspensedPromises();

    expect(mockController.enqueue.mock.calls).toEqual([
      [`<div id="S:1">`],
      ["Loading..."],
      ["</div>"],
      [`<div id="S:2">`],
      ["Loading..."],
      ["</div>"],
      ["<h1>"],
      ["Hello world"],
      ["</h1>"],
      [
        `<template id="U:2"><div>Success U2!</div></template><script id="R:2">u$('2')</script>`,
      ],
      [
        `<template id="U:1">Success U1!</template><script id="R:1">u$('1')</script>`,
      ],
    ]);
  });

  it("should work with nested suspensed and success nodes", async () => {
    const controller = extendStreamController(mockController);
    const firstSuspenseId = controller.nextSuspenseIndex();
    controller.suspensePromise(Promise.resolve());
    const nestedSuspenseId = controller.nextSuspenseIndex();
    controller.suspensePromise(Promise.resolve());

    controller.startTag(`<div id="S:1">`);
    controller.enqueue("Loading S1...");
    controller.startTag(`<div id="S:2">`);
    controller.enqueue("Loading S2...");
    controller.endTag("</div>");
    controller.endTag("</div>");
    controller.startTag("<h1>");
    controller.enqueue("Hello world");
    controller.enqueue("Success U2!", nestedSuspenseId);
    controller.endTag("</h1>");
    controller.enqueue("Success U1!", firstSuspenseId);

    await controller.waitSuspensedPromises();

    expect(mockController.enqueue.mock.calls).toEqual([
      [`<div id="S:1">`],
      ["Loading S1..."],
      [`<div id="S:2">`],
      ["Loading S2..."],
      ["</div>"],
      ["</div>"],
      ["<h1>"],
      ["Hello world"],
      ["</h1>"],
      [
        `<template id="U:2">Success U2!</template><script id="R:2">u$('2')</script>`,
      ],
      [
        `<template id="U:1">Success U1!</template><script id="R:1">u$('1')</script>`,
      ],
    ]);
  });

  it("should work with suspensed fragment with different content", async () => {
    const controller = extendStreamController(mockController);
    const suspenseId = controller.nextSuspenseIndex();
    controller.suspensePromise(Promise.resolve());

    controller.startTag(`<div id="S:1">`);
    controller.enqueue("Loading...");
    controller.endTag("</div>");

    // <>This {'is'} a {'test'}</>
    controller.startTag(null, suspenseId);
    controller.enqueue("This ", suspenseId);
    controller.enqueue("is ", suspenseId);
    controller.enqueue("a ", suspenseId);
    controller.enqueue("test", suspenseId);
    controller.endTag(null, suspenseId);

    await controller.waitSuspensedPromises();

    expect(mockController.enqueue.mock.calls).toEqual([
      [`<div id="S:1">`],
      ["Loading..."],
      ["</div>"],
      [
        `<template id="U:1">This is a test</template><script id="R:1">u$('1')</script>`,
      ],
    ]);
  });
});