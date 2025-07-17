import React from 'react';
import ExecCard from '../ExecCard/ExecCard';
import officers from '../../data/officers.json'; // your JSON

const ExecList = () => {
  return (
    <div>
      {officers.map((exec, index) => (
        <ExecCard key={exec.officer.full_name} exec={exec} reverse={index % 2 !== 0} />
      ))}
    </div>
  );
};

export default ExecList;

