import React, { useEffect, useState } from 'react';
import ExecCard from '../ExecCard/ExecCard';
import localOfficers from '../../data/officers.json'; 
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';
import './ExecList.css';

const ExecList = () => {

	const [officers, setOfficers] = useState(localOfficers); 
  useEffect(() => {
    const fetchOfficers = async () => {
      try {
        const res = await fetch('/api/users/officers');
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const data = await res.json();
        setOfficers(data);
      } catch (err) {
        console.error('Falling back to local officers.json:', err);
        setOfficers(localOfficers);
      }
    };

    fetchOfficers();
  }, []);

  return (
    <div>
      <div className="exec">
        <div className="title-exec">
          <h1 style={{ ...typography.h1, color: colors.darkblue }}>MR. PRESIDENT</h1>
        </div>
        <ExecCard exec={officers.find(exec => exec.title === 'President')} reverse={false} />
      </div>

      <div className="exec">
        <div className="title-exec">
          <h1 style={{ ...typography.h1, color: colors.darkblue }}>Vice Presidents</h1>
        </div>
        <ExecCard exec={officers.find(exec => exec.title === 'Vice President External')} reverse={true} />
        <ExecCard exec={officers.find(exec => exec.title === 'Vice President Internal')} reverse={false} />
      </div>

      <div className="exec">
        <div className="title-exec">
          <h1 style={{ ...typography.h1, color: colors.darkblue }}>Live Events</h1>
        </div>
        {officers
          .filter(exec => exec.title === 'Live Events Director')
          .map((exec, index) => (
            <div key={`${exec.officer.full_name}-${index}`}>
              <ExecCard exec={exec} reverse={index % 2 !== 1} />
              {index === 0 && <div className="divider" />}
            </div>
          ))}
      </div>

      <div className="exec">
        <div className="title-exec">
          <h1 style={{ ...typography.h1, color: colors.darkblue }}>Marketing</h1>
        </div>
        <ExecCard exec={officers.find(exec => exec.title === 'Marketing Director')} reverse={true} />
      </div>

      <div className="exec">
        <div className="title-exec">
          <h1 style={{ ...typography.h1, color: colors.darkblue }}>Creative</h1>
        </div>
        <ExecCard exec={officers.find(exec => exec.title === 'Creative Director')} reverse={false} />
      </div>

      
      <div className="exec">
        <div className="title-exec">
          <h1 style={{ ...typography.h1, color: colors.darkblue }}>Social</h1>
        </div>
        <ExecCard exec={officers.find(exec => exec.title === 'Social Director')} reverse={true} />
      </div>

      <div className="exec">
        <div className="title-exec">
          <h1 style={{ ...typography.h1, color: colors.darkblue }}>Human Resources</h1>
        </div>
        <ExecCard exec={officers.find(exec => exec.title === 'HR Director')} reverse={false} />
      </div>
    </div>
  );
};

export default ExecList;

