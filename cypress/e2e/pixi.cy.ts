function _sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

describe('test pixi touch', () => {
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

  it('2 finger 1 stage', () => {
    cy.visit('/cypress/fixtures/pixi.html');

    cy.wait(1_000)
      .get('#pixi canvas')
      .swipe(
        [
          {
            x: 100,
            y: 100,
          },
          {
            x: 300,
            y: 100,
          },
        ],
        [
          {
            x: 100,
            y: 300,
          },
          {
            x: 300,
            y: 300,
          },
        ],
      );

    cy.wait(1_000)
      .get('#pixi canvas')
      .toMatchImageSnapshot();
  });

  it('2 finger 2 stage with config', () => {
    cy.visit('/cypress/fixtures/pixi.html');

    cy.wait(1_000)
      .get('#pixi canvas')
      .swipe(
        {
          delay: 1000,
          draw: false,
        },
        [
          {
            x: 100,
            y: 100,
          },
          {
            x: 300,
            y: 100,
          },
        ],
        [
          {
            x: 100,
            y: 300,
          },
          {
            x: 300,
            y: 300,
          },
        ],
        [
          {
            x: 150,
            y: 300,
          },
          {
            x: 350,
            y: 300,
          },
        ],
      );

    cy.wait(1_000)
      .get('#pixi canvas')
      .toMatchImageSnapshot();
  });
});
