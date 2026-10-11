const Form = () => {
    return (
        <div>
            <form action="submit">
                <div className=' flex flex-col' >
                    <div>


                        <div className='text-black'>Email </div>
                        <input className='placeholder-black/70 border mx-auto' placeholder='Enter your email address' type="
                    text" />
                    </div>
                    <div>


                        <div className='text-black'>Password</div>
                        <input className='placeholder-black/70 border mx-auto' placeholder='Enter your password' type="
                    password" />
                    </div>
                </div>
            </form>
        </div>
    )
}

export default Form