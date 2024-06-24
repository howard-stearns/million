import { Croquet, join } from './administrivia.mjs';

// A "Player" can be a browser or the leader of some bots.
// Each player joins the "player" session and has a replicated model of the current parameters,
// can change parameters with session.view.setParameters(),
// and gets notified by onchange when the parameters change.

const Q = Croquet.Constants;
Q.VIEW_JOIN = 'view-join';
Q.VIEW_EXIT = 'view-exit';
Q.SET_PARAMETERS = 'setParameters';
Q.PARAMETERS_SET = 'parametersSet';
Q.VIEW_COUNT_CHANGED = 'viewCountChanged';

class PlayerModel extends Croquet.Model { // Keeps track of the model.
  init(parameters) {
    super.init();
    this.parameters = parameters;
    this.subscribe(this.sessionId, Q.SET_PARAMETERS, this.setParameters);
    this.subscribe(this.sessionId, Q.VIEW_JOIN, this.viewJoin);
    this.subscribe(this.sessionId, Q.VIEW_EXIT, this.viewExit);    
  }
  viewJoin(viewId) {
    console.log('enter', viewId, this.viewCount);
    this.publish(this.sessionId, Q.VIEW_COUNT_CHANGED, this.viewCount);
    console.log('published');    
  }
  viewExit(viewId) {
    console.log('exit', viewId, this.viewCount);
    this.publish(this.sessionId, Q.VIEW_COUNT_CHANGED, this.viewCount);
    console.log('published');
  }
  setParameters(parameters) {
    this.parameters = Object.assign(this.parameters, parameters);
    this.publish(this.sessionId, Q.PARAMETERS_SET, this.parameters);
  }
}
PlayerModel.register(PlayerModel.name);

class PlayerView extends Croquet.View { // Interface to the model.
  constructor(model, {onchange}) {
    super(model);
    this.model = model;
    this.onchange = onchange;
    this.subscribe(this.sessionId, Q.PARAMETERS_SET, this.parametersSet);
    this.subscribe(this.sessionId, Q.VIEW_COUNT_CHANGED, this.viewCountChanged);
  }
  setParameters(parameters) {
    this.publish(this.sessionId, 'setParameters', parameters);
  }
  parametersSet(parameters) {
    setTimeout(() => this.onchange?.(parameters));
  }
  viewCountChanged(viewCount) {
    console.log({viewCount});
    setTimeout(() => this.onchange?.({sessionAction: 'viewCountChanged', ...this.model.parameters, viewCount}));
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
