export function log(spacing, sessionName, viewId, label, ...data) { // Called from the machinery. Can be no-op, or report to somewhere.
  const sessionElement = document.getElementById(sessionName),
        activity = sessionElement?.querySelector('activity'),
        dist = sessionElement?.querySelector('distribution');
  if (!sessionElement) return; // Got removed while we were working.
  if (label === 'start coordinating') {  // When we lay down another level, add the display structure.
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
  }
  if (label.startsWith('start co')) {
    dist.textContent = data[1].inProgress.map(part => part.size);
    label += ' ' + data[0];
  } else if (label === 'collected output') {
    dist.textContent = '';
    activity.classList.add('completed');
    label += ': ' + data[0];
  }
  activity.textContent = label;

  // if (label.startsWith('start co')) data.splice(1, 1);  // The model arg in this case is overkill. It's there for browser tracing.
  // console.log(spacing, sessionName, viewId, label, ...data);
}
