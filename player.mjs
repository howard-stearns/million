import { Croquet, join } from './administrivia.mjs';
export { Croquet, join };

// A "Player" can be a browser or the leader of some bots.
// Each player joins the "player" session and has a replicated model of the current parameters,
// can change parameters with session.view.setParameters(),
// and will have PlayerView.parametersSet or viewCountChanged when things change.
// PlayerView can be subclassed for different behavior.

const Q = Croquet.Constants;
Q.VIEW_JOIN = 'view-join';
Q.VIEW_EXIT = 'view-exit';
Q.SET_PARAMETERS = 'setParameters';
Q.PARAMETERS_SET = 'parametersSet';
Q.VIEW_COUNT_CHANGED = 'viewCountChanged';

export class PlayerModel extends Croquet.Model { // Keeps track of the model.
  init(parameters) {
    super.init();
    this.parameters = parameters;
    this.subscribe(this.sessionId, Q.SET_PARAMETERS, this.setParameters);
    this.subscribe(this.sessionId, Q.VIEW_JOIN, this.viewJoin);
    this.subscribe(this.sessionId, Q.VIEW_EXIT, this.viewExit);    
  }
  viewJoin(viewId) {
    this.publish(this.sessionId, Q.VIEW_COUNT_CHANGED, this.viewCount);
  }
  viewExit(viewId) {
    this.publish(this.sessionId, Q.VIEW_COUNT_CHANGED, this.viewCount);
  }
  setParameters(parameters) {
    this.parameters = Object.assign(this.parameters, parameters);
    this.publish(this.sessionId, Q.PARAMETERS_SET, this.parameters);
  }
}
PlayerModel.register(PlayerModel.name);

export class PlayerView extends Croquet.View { // Interface to the model.
  constructor(model) {
    super(model);
    this.model = model;
    this.subscribe(this.sessionId, Q.PARAMETERS_SET, this.parametersSet);
    this.subscribe(this.sessionId, Q.VIEW_COUNT_CHANGED, this.viewCountChanged);
    this.viewCountChanged(model.viewCount);
  }
  setParameters(parameters) {
    this.publish(this.sessionId, 'setParameters', parameters);
  }
  parametersSet(parameters) {
    // Subclass to extend behavior.
  }
  viewCountChanged(viewCount) {
    // Subclass to extend behavior.
  }
}

export function player(sessionName, initialParameters = {}, ViewClass = PlayerView) {
  return join({
    name: sessionName, // NOT drawn from initialParameters, because that controls other activity.
    model: PlayerModel,
    view: ViewClass,
    options: initialParameters
  });
}

