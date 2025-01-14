# touch testing helper for Cypress

Fork from [nTopus/cy-mobile-commands](https://gitlab.com/nTopus/cy-mobile-commands), most of the changes came from [dmtrKovalenko/cypress-real-events](https://github.com/dmtrKovalenko/cypress-real-events). Support e2e testing of multi-touch in rendering libraries like pixi.js.

## Installing

### Step 1, intall this package

```bash
npm install --save-dev cypress-touch-command
```

### Step 2, load it to your Cypress test context

Open `cypress/support/e2e.ts` and add:

```javascript
import 'cypress-touch-command';
```

## Commands

### `swipe`

#### Syntax

```javascript
.swipe(checkpoint1, checkpoint2[, ..., checkpointN])
.swipe(configObject, checkpoint1, checkpoint2[, ..., checkpointN])
```

The `configObject` parameter is optional. The available options are:

- `delay`: (number of milliseconds = 1000) the delta time from the `touchstart` to `touchend`.
- `steps`: (integer = computed) the number of steps between two checkpoints.
- `draw`: (boolean = true) display the swipe path over the page.

You can set two or more steps to make the swipe path as complex as you need.

Where `checkpoint#` musc be an array of positions. An array of positions perform a multi touch action.

Where position can be:

- A explicit position defined with number values: `{ x: 100, y: 100 }`.

### Usage example

```javascript
it('1 finger 1 stage', () => {
  cy.visit('/cypress/fixtures/pixi.html');

  cy.wait(1_000)
    .get('#pixi canvas')
    .swipe(
      [
        {
          x: 100,
          y: 100,
        },
      ],
      [
        {
          x: 100,
          y: 300,
        },
      ],
    );

  cy.wait(1_000)
    .get('#pixi canvas')
    .toMatchImageSnapshot();
});
```

[For more usage examples, see the our tests.](https://github.com/muzea/cypress-touch-command/blob/master/cypress/e2e/pixi.cy.ts)
