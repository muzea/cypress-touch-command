/// <reference types="cypress" />

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function fireCdpCommand(command: string, params: Record<string, unknown>): Promise<any> {
  return Cypress.automation('remote:debugger:protocol', {
    command,
    params,
  });
}

interface _Position {
  x: number;
  y: number;
}

function getPositionedCoordinates(
  x0: number,
  y0: number,
  width: number,
  height: number,
  position: _Position,
  frameScale: number,
) {
  const { x, y } = position;
  // scale the position coordinates according to the viewport scale
  return [x0 + x * frameScale, y0 + y * frameScale];
}

function getFrameElement(currentWindow: Window): HTMLElement {
  if (currentWindow.frameElement) {
    // accessible for same-origin iframes
    // or when running with --disable-web-security
    return currentWindow.frameElement as HTMLElement;
  }

  // fallback to querying using the parent window, mainly to grab the AUT iframe
  return [...currentWindow.parent.document.querySelectorAll('iframe')].find(
    iframe => iframe.contentWindow === currentWindow,
  )!;
}

function getIframesPositionShift(element: HTMLElement) {
  let currentWindow: Window | null = element.ownerDocument.defaultView;
  const noPositionShift = {
    frameScale: 1,
    frameX: 0,
    frameY: 0,
  };

  if (!currentWindow) {
    return noPositionShift;
  }

  // eslint-disable-next-line prefer-const
  const iframes = [];

  while (currentWindow !== window.top) {
    iframes.push(getFrameElement(currentWindow));
    currentWindow = currentWindow.parent;
  }

  return iframes.reduceRight(({ frameX, frameY, frameScale }, frame) => {
    const { x, y, width } = frame.getBoundingClientRect();

    return {
      frameX: frameX + x * frameScale,
      frameY: frameY + y * frameScale,
      frameScale: frameScale * (width / frame.offsetWidth),
    };
  }, noPositionShift);
}

function getElementPositionXY(htmlElement: HTMLElement) {
  const { x: elementX, y: elementY, width, height } = htmlElement.getBoundingClientRect();

  const { frameScale, frameX, frameY } = getIframesPositionShift(htmlElement);

  return {
    x: frameX + elementX * frameScale,
    y: frameY + elementY * frameScale,
    width: width * frameScale,
    height: height * frameScale,
    frameScale: frameScale,
  };
}

/**
 * Cypress Automation debugee is the whole tab.
 * This function returns the element coordinates relative to the whole tab root that can be used in CDP request.
 * @param jqueryEl the element to introspect
 * @param position the position of the event interaction on the element
 */
function getCypressElementCoordinates(jqueryEl: JQuery, position: _Position) {
  const htmlElement = jqueryEl.get(0);
  const cypressAppFrame = window.parent.document.querySelector('iframe');

  if (!cypressAppFrame) {
    throw new Error(
      'Can not find cypress application iframe, it looks like critical issue. Please rise an issue on GitHub.',
    );
  }

  const { x, y, width, height, frameScale } = getElementPositionXY(htmlElement);
  const [posX, posY] = getPositionedCoordinates(x, y, width, height, position, frameScale);

  return {
    x: posX,
    y: posY,
    frameScale: frameScale,
  };
}

const _SVG_NS = 'http://www.w3.org/2000/svg';

const COLORS: string[] = ['#00F', '#0CE', '#0E0', '#EA0', '#F00'];

declare class InputDeviceCapabilities {
  public firesTouchEvents: boolean;
  constructor(opts: { firesTouchEvents: boolean });
}

declare namespace Cypress {
  interface Chainable<Subject> {
    swipe(...input: FingerPosition[][]): Chainable<void>;
    swipe(config: SwipeConfig, ...input: FingerPosition[][]): Chainable<void>;
  }
}

type FingerPosition = {
  x: number;
  y: number;
};

type Fingers = FingerPosition[];

type SwipeConfig = { steps?: number; delay: number; draw: boolean };
type InputParams = FingerPosition[][] | [SwipeConfig, ...FingerPosition[]];
type TouchEventConfig = { fingers: FingerPosition[]; checkpoint?: boolean };

type EventName = 'touchstart' | 'touchmove' | 'touchend';

let prevTime = 0;

class SVGCanvas {
  doc: HTMLDocument;
  svg: SVGElement;
  lines: SVGPathElement[];

  constructor(doc: HTMLDocument) {
    this.doc = doc;
    this.svg = doc.createElementNS(_SVG_NS, 'svg');
    this.svg.setAttribute('width', doc.body.clientWidth.toString());
    this.svg.setAttribute('height', doc.body.clientHeight.toString());
    this.svg.style.position = 'absolute';
    this.svg.style.top = '0';
    this.svg.style.left = '0';
    this.svg.style.zIndex = '99999999';
    this.svg.style.pointerEvents = 'none';
    doc.body.appendChild(this.svg);
    this.lines = [];
  }

  startLine(finger: number, x: number, y: number) {
    let line = this.doc.createElementNS(_SVG_NS, 'path');
    line.setAttribute('fill', 'transparent');
    line.setAttribute('stroke', '#FFF'); // COLORS[finger])
    line.setAttribute('stroke-width', '6');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('opacity', '0.5');
    line.setAttribute('d', `M ${x},${y}`);
    this.svg.appendChild(line);
    this.lines[finger] = line;
  }

  extendLine(finger: number, x: number, y: number) {
    const line = this.lines[finger];
    line.setAttribute('d', line.getAttribute('d') + ` L ${x},${y}`);
  }

  mkDot(className: string, x: number, y: number, radius: number, color: string, stroke?: number): SVGCircleElement {
    let dot = this.doc.createElementNS(_SVG_NS, 'circle');
    dot.setAttribute('cx', x.toString());
    dot.setAttribute('cy', y.toString());
    dot.setAttribute('r', radius.toString());
    dot.setAttribute('class', className);
    if (stroke) {
      let dotBorder = this.doc.createElementNS(_SVG_NS, 'circle');
      dotBorder.setAttribute('cx', x.toString());
      dotBorder.setAttribute('cy', y.toString());
      dotBorder.setAttribute('r', radius.toString());
      dotBorder.setAttribute('opacity', '0.5');
      dotBorder.setAttribute('fill', 'transparent');
      dotBorder.setAttribute('stroke', '#FFF');
      dotBorder.setAttribute('stroke-width', `${stroke + 4}`);
      this.svg.appendChild(dotBorder);
      dot.setAttribute('fill', 'transparent');
      dot.setAttribute('stroke', color);
      dot.setAttribute('stroke-width', stroke.toString());
    } else {
      dot.setAttribute('fill', color);
    }
    dot.setAttribute('opacity', '0.6');
    this.svg.appendChild(dot);
    return dot;
  }

  touchstart(finger: number, x: number, y: number) {
    this.mkDot('start-' + finger, x, y, 8, COLORS[finger], 3);
    this.startLine(finger, x, y);
  }

  touchmove(finger: number, x: number, y: number, checkpoint: boolean) {
    const className = (checkpoint ? 'checkpoint-' : 'move-') + finger;
    this.mkDot(className, x, y, checkpoint ? 4 : 2, COLORS[finger]);
    this.extendLine(finger, x, y);
  }

  touchend(finger: number, x: number, y: number) {
    this.mkDot('end-' + finger, x, y, 5, COLORS[finger], 3);
    this.extendLine(finger, x, y);
    if (finger === 0) setTimeout(() => this.doc.body.removeChild(this.svg), 100);
  }
}

function getOffset(
  element: HTMLElement,
  offset = { top: 0, left: 0 },
): {
  top: number;
  left: number;
} {
  if (element.offsetTop && element.offsetLeft) {
    offset = {
      top: element.offsetTop + offset.top,
      left: element.offsetLeft + offset.left,
    };
  }
  return element.parentElement ? getOffset(element.parentElement, offset) : offset;
}

Cypress.Commands.add(
  'swipe',
  // @ts-ignore
  { prevSubject: true },
  (target: JQuery<HTMLElement>, ...path: InputParams) => {
    let config = { delay: 1000, draw: true };
    if (typeof path[0] !== 'string' && !('length' in path[0])) {
      config = Object.assign(config, path.shift());
    }
    new Swipe(target, config, path as FingerPosition[][]);
  },
);

const MapEvName = {
  touchstart: 'touchStart',
  touchend: 'touchEnd',
  touchmove: 'touchMove',
  touchcancel: 'touchCancel',
};

class Swipe {
  target: JQuery<HTMLElement>;
  touchCanvas: SVGCanvas | null;
  delay: number;
  stepDelay: number;
  steps: number;
  win!: Window;
  path: FingerPosition[][];

  constructor(target: JQuery<HTMLElement>, { steps = 0, delay, draw }: SwipeConfig, path: FingerPosition[][]) {
    this.target = target;
    this.touchCanvas = null;
    this.delay = delay;
    if (!steps) {
      steps = Math.round(12 / (path.length - 1));
      if (steps < 2) steps = 2;
    }
    this.stepDelay = Math.round(this.delay / (steps * (path.length - 1)));
    if (this.stepDelay > 150) {
      steps *= 2;
      this.stepDelay = Math.round(this.delay / (steps * (path.length - 1)));
    }
    this.steps = steps;
    this.path = path;
    if (draw) {
      this.touchCanvas = new SVGCanvas(this.target[0].ownerDocument);
    }
    cy.window({ log: false }).then(win => {
      this.win = win;
      return this.doIt();
    });
  }

  async doIt() {
    const myTarget = this.target;
    const myPath = this.path.map(step => `${step}: ${step}`);
    Cypress.log({
      $el: myTarget,
      name: 'do swipe',
      message: this.path.map(i => i.map(j => `[x:${j.x},y:${j.y}]`)).join('->'),
      consoleProps: () => ({ delay: this.delay, path: myPath }),
    });
    for (let checkpoint = 1; checkpoint < this.path.length; checkpoint++) {
      await this.updateFingerMove(this.path[checkpoint - 1], this.path[checkpoint], checkpoint);
    }
  }

  async updateFingerMove(from: FingerPosition[], to: FingerPosition[], checkpoint: number) {
    let fingersFrom = from;
    let fingersTo = to;
    let checkpointEv: EventName = checkpoint === 1 ? 'touchstart' : 'touchmove';
    let evConfCP = { fingers: fingersFrom, checkpoint: true };
    await this.dispatchTouchEvent(checkpointEv, evConfCP);
    for (let i: number = 1; i < this.steps; i++) {
      let fingers: FingerPosition[] = fingersFrom.map(({ x, y }: FingerPosition, f: number) => {
        return {
          x: x * (1 - i / this.steps) + fingersTo[f].x * (i / this.steps),
          y: y * (1 - i / this.steps) + fingersTo[f].y * (i / this.steps),
        };
      });
      await sleep(this.stepDelay);
      await this.dispatchTouchEvent('touchmove', { fingers });
    }
    if (checkpoint === this.path.length - 1) {
      let evConfEnd = { fingers: fingersTo };
      await sleep(this.stepDelay);
      await this.dispatchTouchEvent('touchend', evConfEnd);
    }
  }

  async dispatchTouchEvent(evName: EventName, { fingers, checkpoint }: TouchEventConfig) {
    let touches = fingers.map((pos, index) => {
      const elementCoordinates = getCypressElementCoordinates(this.target, pos);

      let x = elementCoordinates.x;
      let y = elementCoordinates.y;

      x = Math.round(x);
      y = Math.round(y);
      return {
        id: index,
        x: x,
        y: y,
      };
    });

    const baseName = 'swipe ' + (evName === 'touchstart' ? 'start' : evName === 'touchend' ? 'end' : 'checkpoint');
    fingers.forEach((touch, i) => {
      const name = fingers.length === 1 ? baseName : baseName + ' ' + i;
      if (checkpoint || evName === 'touchend')
        Cypress.log({
          $el: this.target,
          name,
          message: `${touch.x}, ${touch.y}`,
        });
      if (this.touchCanvas) {
        this.touchCanvas[evName](i, touch.x, touch.y, !!checkpoint);
      }
    });

    if (prevTime === 0) {
      prevTime = +new Date();
    }
    const current = +new Date();
    await fireCdpCommand('Input.dispatchTouchEvent', {
      type: MapEvName[evName],
      touchPoints: touches,
    });
  }
}
