export function log(sessionName, viewId, label, ...data) { // Called from the machinery. Can be no-op, or report to somewhere.
  console.log(sessionName, viewId, label, ...data);
  const sessionElement = document.getElementById(sessionName),
        activity = sessionElement?.querySelector('activity'),
        dist = sessionElement?.querySelector('distribution');
  if (!sessionElement) return; // Got removed while we were working.
  if (label.startsWith('start co')) {
    dist.textContent = data[1].inProgress.map(part => part.size);
  }
  if (label === 'start coordinating') {
    const index = data[0],
          subName = `${sessionName}-${index}`;
    if (document.getElementById(subName)) return;
    const child = document.createElement('li');
    const name = document.createElement('name');
    name.textContent = child.id = subName;
    child.append(name);
    child.append(' ');
    child.append(document.createElement('activity'));
    child.append(document.createElement('distribution'));
    child.append(document.createElement('ul'));
    sessionElement.querySelector('ul').append(child);
    label += ' ' + index;
  }
  if (label === 'collected output') {
    dist.textContent = '';
    activity.classList.add('completed');
    label += ': ' + data[0];
  }
  activity.textContent = label;
}
