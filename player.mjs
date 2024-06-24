import { Croquet, join } from './administrivia.mjs';

// A "Player" can be a browser or the leader of some bots.
// Each player joins the "player" session and has a replicated model of the current parameters,
// can change parameters with session.view.setParameters(),
// and gets notified by onchange when the parameters change.

class PlayerModel extends Croquet.Model { // Keeps track of the model.
  init(parameters) {
    super.init();
    this.parameters = parameters;
    this.subscribe(this.sessionId, 'setParameters', this.setParameters);
    this.subscribe(this.sessionId, 'view-join', this.viewJoin);
    this.subscribe(this.sessionId, 'view-join', this.viewExit);    
  }
  viewJoin(viewId) {
    this.publish(this.sessionId, 'viewCountChanged', this.viewCount);
  }
  viewExit(viewId) {
    this.publish(this.sessionId, 'viewCountChanged', this.viewCount);
  }
  setParameters(parameters) {
    this.parameters = Object.assign(this.parameters, parameters);
    this.publish(this.sessionId, 'parametersSet', this.parameters);
  }
}
PlayerModel.register(PlayerModel.name);

class PlayerView extends Croquet.View { // Interface to the model.
  constructor(model, {onchange}) {
    super(model);
    this.model = model;
    this.onchange = onchange;
    this.subscribe(this.sessionId, 'parametersSet', this.parametersSet);
    this.subscribe(this.sessionId, 'viewCountChanged', this.viewCountChanged);
  }
  setParameters(parameters) {
    this.publish(this.sessionId, 'setParameters', parameters);
  }
  parametersSet(parameters) {
    setTimeout(() => this.onchange?.(parameters));
  }
  viewCountChanged(viewCount) {
    setTimeout(() => this.onchange?.({sessionAction: 'viewCountChanged', viewCount, ...this.model.parameters}));
  }
}

export function player(sessionName, initialParameters, onchange = console.log) {
  return join({
    name: sessionName, // NOT drawn from initialParameters, because that controls other activity.
    model: PlayerModel,
    view: PlayerView,
    options: initialParameters,
    viewOptions: {onchange}
  });
}
