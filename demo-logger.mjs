export function log(sessionName, viewId, label, ...data) { // Called from the machinery. Can be no-op, or report to somewhere.
  console.log(sessionName, viewId, label, ...data);
  const sessionElement = document.getElementById(sessionName),
        activity = sessionElement?.querySelector('activity');
  activity.textContent = label;
  if (label === 'start coordinating') {
    const index = data[0],
          subName = `${sessionName}-${index}`;
    if (document.getElementById(subName)) return;
    const child = document.createElement('li');
    child.id = subName;
    child.append(document.createElement('activity'));
    child.append(document.createElement('distribution'));
    child.append(document.createElement('ul'));
    sessionElement.querySelector('ul').append(child);
  }
}
