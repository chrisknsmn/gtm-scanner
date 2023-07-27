import React, { useEffect, useState } from 'react';
import './App.css';

import LoadingIcon from './icons/loading';

const App: React.FC = () => {

const [data, setData] = useState<any>(null);
const [text, setText] = useState('');

const [showLoading, setShowLoading] = useState(false);
const [showTable, setShowTable] = useState(false);

// Separate out the logic into a new function
const sendData = async (text: string) => {
    try {
        await fetch('http://localhost:5001/api', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });
        // Don't set the new data state here
    } catch (error) {
        console.error('Failed to send data:', error);
    }
}

const fetchData = async () => {
    const response = await fetch('http://localhost:5001/api');
    const dataString = await response.text();
    try {
        const data = JSON.parse(dataString);
        setData(data);
    } catch (error) {
        console.log('JSON incomplete');
    }
}

useEffect(() => {

    const createWebSocket = () => {
        const ws = new WebSocket('ws://localhost:5001');
    
        ws.onopen = () => {
            console.log('Connected to WebSocket server');
        };
    
        ws.onmessage = (e) => {
            setShowLoading(false);
            setShowTable(true);
            console.log('File updated. Fetching data...');
            fetchData(); // Fetch the updated data when a WebSocket message is received
        };
    
        ws.onclose = () => {
            console.log('WebSocket closed. Reconnecting...');
            setTimeout(createWebSocket, 5000);
        };
        return ws;
    };

    const ws = createWebSocket();

    return () => {
        console.log('Closing WebSocket');
        ws.close();
    };

}, []);

const handleSubmit = async (event: React.FormEvent) => {
    setShowLoading(true);
    setShowTable(false);
    event.preventDefault();
    sendData(text); //Call sendData on form submission
}

const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    setData('');
    
}

return (
    <section>
        <div className='section-inner'>
            
            <h1>GTM Scanner</h1>
            <p className='body-text'>
                This form receives a list of urls, scans each link and returns a list of the GTM containers existing on each page.
            </p>

            <div className='card'>
                <h2>Input</h2>
                <form onSubmit={handleSubmit}>
                    <div>
                        <textarea id="input" name="input" onChange={handleChange} value={text}></textarea>
                    </div>
                    <button type="submit" id="submit">Submit</button>
                </form>
            </div>

            <div className='table-card mar-t'>
                <h2>Results</h2>
                <div id="loading" className={showLoading ? 'display-block' : 'display-none'}>
                    <LoadingIcon />
                </div>
                <table className={showTable ? 'display-block' : 'display-none'}>
                    <thead>
                        <tr>
                            <th>URL:</th>
                            <th>Containers:</th>
                        </tr>
                    </thead>
                    <tbody>
                        {
                            data && Object.keys(data).map((outerKey) => {
                                
                                const item = data[outerKey];
                                const url = item['1'];

                                // Skip this iteration if url is blank
                                if(url === '' || url === null || url === undefined) {
                                    return null;
                                }
                                
                                let containers = [];
                                if(item['2'] !== undefined) {
                                    try {
                                        containers = JSON.parse(item['2']);
                                    } catch (error) {
                                        console.error('Failed to parse containers:', error);
                                    }
                                }
                                return (
                                    <tr key={outerKey}>
                                        <td>
                                            {url}
                                        </td>
                                        {containers.map((cont: string, contIndex: number) => {
                                            return (
                                                <td key={contIndex}>{cont}</td>
                                            )
                                        }
                                        )}
                                    </tr>
                                )
                            })
                        }
                    </tbody>
                </table>
            </div>

        </div>
    </section>
);
};

export default App;