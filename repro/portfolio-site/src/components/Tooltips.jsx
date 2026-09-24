import { Tooltip } from 'react-tooltip';

// Shared react-tooltip instances: generic UI hints and rich skill explanations.
export default function Tooltips() {
  return (
    <>
      <Tooltip id="ui-tip" className="rt-tip" place="bottom" offset={12} delayShow={250} />
      <Tooltip
        id="skill-tip"
        className="rt-tip rt-tip--rich"
        place="top"
        offset={12}
        render={({ content, activeAnchor }) =>
          content ? (
            <span className="rt-rich">
              <strong>
                {activeAnchor?.dataset.name}
                <em>{activeAnchor?.dataset.years}</em>
              </strong>
              <span>{content}</span>
            </span>
          ) : null
        }
      />
    </>
  );
}
