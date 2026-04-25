type ProgressProps = {
    value: number;
    label: string;
};

function Progress({ value, label }: ProgressProps) {
    const bounded = Math.max(0, Math.min(100, value));

    return (
        <div aria-label={label} className="ui-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bounded}>
            <div className="ui-progress__bar" style={{ width: `${bounded}%` }} />
        </div>
    );
}

export default Progress;
